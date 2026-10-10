import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCashfreeConfigured, mapRefundStatus, verifyWebhookSignature } from "@/lib/payments/cashfree";
import { syncOrderPayment } from "@/lib/payments/sync";
import { sendOrderEmail } from "@/lib/email/order-emails";
import { rupeesToPaise } from "@/lib/money";

/**
 * Cashfree webhooks (payments + refunds).
 *  1. Verify the HMAC signature over the raw body.
 *  2. Deduplicate: each event is stored once in webhook_events (provider, event_key).
 *  3. Never trust the payload for money: payment events trigger a server-side
 *     re-check with Cashfree (syncOrderPayment); all DB transitions are idempotent.
 * Returns 2xx for processed or duplicate events, 5xx so Cashfree retries on failure.
 */
export async function POST(request: NextRequest) {
  if (!isCashfreeConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const raw = await request.text();
  const ok = verifyWebhookSignature(raw, request.headers.get("x-webhook-timestamp"), request.headers.get("x-webhook-signature"));
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  let event: { type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const eventKey = request.headers.get("x-idempotency-key") || createHash("sha256").update(raw).digest("hex");
  const supabase = createAdminClient();

  const { data: inserted, error: insertError } = await supabase
    .from("webhook_events")
    .insert({ provider: "cashfree", event_key: eventKey, type: event.type ?? null, payload: event as never })
    .select("id")
    .maybeSingle();

  let rowId = inserted?.id;
  if (insertError) {
    if (insertError.code !== "23505") {
      console.error("[webhook] store", insertError.message);
      return NextResponse.json({ error: "store failed" }, { status: 500 });
    }
    // Seen before: skip if processed, otherwise retry processing.
    const { data: existing } = await supabase.from("webhook_events").select("id, processed_at").eq("provider", "cashfree").eq("event_key", eventKey).single();
    if (existing?.processed_at) return NextResponse.json({ ok: true, duplicate: true });
    rowId = existing?.id;
  }

  try {
    await handle(event);
    await supabase.from("webhook_events").update({ processed_at: new Date().toISOString(), error: null }).eq("id", rowId!);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[webhook] handle", event.type, e);
    await supabase.from("webhook_events").update({ error: String(e).slice(0, 500) }).eq("id", rowId!);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}

async function handle(event: { type?: string; data?: Record<string, unknown> }) {
  const data = (event.data ?? {}) as {
    order?: { order_id?: string };
    refund?: { refund_id?: string; cf_refund_id?: string | number; refund_status?: string; refund_amount?: number; order_id?: string };
  };

  switch (event.type) {
    case "PAYMENT_SUCCESS_WEBHOOK":
    case "PAYMENT_FAILED_WEBHOOK":
    case "PAYMENT_USER_DROPPED_WEBHOOK": {
      const orderNumber = data.order?.order_id;
      if (orderNumber) await syncOrderPayment(orderNumber, "cashfree:webhook");
      return;
    }
    case "REFUND_STATUS_WEBHOOK": {
      const r = data.refund;
      if (!r?.refund_id) return;
      const supabase = createAdminClient();
      const status = mapRefundStatus(r.refund_status ?? "PENDING");
      const { error } = await supabase.rpc("apply_refund_status", {
        p_refund_id: r.refund_id,
        p_status: status,
        p_cf_refund_id: String(r.cf_refund_id ?? ""),
        p_raw: r as never,
      });
      if (error && !error.message.includes("REFUND_NOT_FOUND")) throw new Error(error.message);
      if (status === "success") {
        const { data: refund } = await supabase.from("refunds").select("order_id").eq("refund_id", r.refund_id).maybeSingle();
        if (refund) await sendOrderEmail(refund.order_id, "refunded", { refundAmount: r.refund_amount ? rupeesToPaise(r.refund_amount) : undefined });
      }
      return;
    }
    default:
      // Other event types (e.g. settlements) are stored but not acted on.
      return;
  }
}
