import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv, serverEnv } from "@/lib/env";
import { formatINR } from "@/lib/money";
import { site } from "@/lib/site";
import { sendEmail } from "@/lib/email/send";

type Kind = "placed" | "paid" | "shipped" | "delivered" | "cancelled" | "refunded";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, intro: string, body: string, cta?: { href: string; label: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f6f0f7;font-family:Helvetica,Arial,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e8dcec">
<tr><td style="padding:24px 32px;background:#a357b7;text-align:center">
<span style="font-size:26px;font-weight:800;color:#ffffff">StarGod</span><br><span style="font-size:10px;font-weight:bold;letter-spacing:3px;color:#ffffff">PREMIUM PERFUMES</span></td></tr>
<tr><td style="padding:32px">
<h1 style="font-weight:800;font-size:22px;color:#2a1230;margin:0 0 12px">${esc(title)}</h1>
<p style="font-size:15px;line-height:1.6;color:#44403c;margin:0 0 20px">${intro}</p>
${body}
${cta ? `<p style="margin:24px 0 0"><a href="${cta.href}" style="display:inline-block;background:#a357b7;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:12px;letter-spacing:2px;text-transform:uppercase">${esc(cta.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:18px 32px;background:#faf8f4;font-size:11px;color:#a8a29e;text-align:center">
Questions? Reply to this email or write to ${esc(site.supportEmail)}.<br>${esc(site.name)}</td></tr>
</table></td></tr></table></body></html>`;
}

/** Loads the order and sends the matching customer email. Safe to call fire-and-forget. */
export async function sendOrderEmail(orderId: string, kind: Kind, extra?: { refundAmount?: number; courier?: string; awb?: string; trackingUrl?: string | null }) {
  try {
    const supabase = createAdminClient();
    const { data: o } = await supabase
      .from("orders")
      .select("order_number, total, subtotal, offer_discount, discount, shipping_fee, cod_fee, payment_method, shipping_address, contact_email, user_id, order_items(product_name, variant_label, qty, line_total)")
      .eq("id", orderId)
      .single();
    if (!o) return;

    let to = o.contact_email;
    if (!to) {
      const { data: p } = await supabase.from("profiles").select("email").eq("id", o.user_id).single();
      to = p?.email ?? null;
    }
    if (!to) return;

    const addr = o.shipping_address as Record<string, string>;
    const name = (addr?.name ?? "").split(" ")[0] || "there";
    const url = `${publicEnv().NEXT_PUBLIC_SITE_URL}/account/orders/${o.order_number}`;

    const items = `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px solid #efe9df">
${o.order_items.map((i) => `<tr><td style="padding:10px 0;border-bottom:1px solid #efe9df">${esc(i.product_name)} <span style="color:#78716c">(${esc(i.variant_label)}) × ${i.qty}</span></td><td align="right" style="padding:10px 0;border-bottom:1px solid #efe9df">${formatINR(i.line_total)}</td></tr>`).join("")}
${o.offer_discount ? `<tr><td style="padding:6px 0;color:#78716c">Buy 1 Get 1</td><td align="right">−${formatINR(o.offer_discount)}</td></tr>` : ""}
${o.discount ? `<tr><td style="padding:6px 0;color:#78716c">Discount</td><td align="right">−${formatINR(o.discount)}</td></tr>` : ""}
<tr><td style="padding:6px 0;color:#78716c">Shipping</td><td align="right">${o.shipping_fee ? formatINR(o.shipping_fee) : "Free"}</td></tr>
${o.cod_fee ? `<tr><td style="padding:6px 0;color:#78716c">COD fee</td><td align="right">${formatINR(o.cod_fee)}</td></tr>` : ""}
<tr><td style="padding:10px 0;font-weight:bold">Total</td><td align="right" style="font-weight:bold">${formatINR(o.total)}</td></tr></table>
<p style="font-size:13px;color:#78716c;margin:16px 0 0">Delivering to ${esc(addr?.name)}, ${esc(addr?.line1)}, ${esc(addr?.city)} ${esc(addr?.pincode)}</p>`;

    const n = esc(o.order_number);
    const map: Record<Kind, { subject: string; title: string; intro: string; body: string }> = {
      placed: {
        subject: `Order ${o.order_number} confirmed`,
        title: "Thank you for your order",
        intro: `Hi ${esc(name)}, we've received order <b>${n}</b>${o.payment_method === "cod" ? ". Please keep the amount ready for Cash on Delivery." : "."} We'll email you when it ships.`,
        body: items,
      },
      paid: {
        subject: `Payment received: order ${o.order_number}`,
        title: "Payment received",
        intro: `Hi ${esc(name)}, your payment for order <b>${n}</b> was successful. We're preparing it for dispatch.`,
        body: items,
      },
      shipped: {
        subject: `Your order ${o.order_number} has shipped`,
        title: "It's on its way",
        intro: `Hi ${esc(name)}, order <b>${n}</b> has shipped${extra?.courier ? ` with ${esc(extra.courier)}` : ""}${extra?.awb ? ` (AWB ${esc(extra.awb)})` : ""}.`,
        body: extra?.trackingUrl ? `<p><a href="${esc(extra.trackingUrl)}">Track with the courier</a></p>` : "",
      },
      delivered: {
        subject: `Order ${o.order_number} delivered`,
        title: "Delivered",
        intro: `Hi ${esc(name)}, order <b>${n}</b> has been delivered. We hope you love it. A quick review helps other fragrance lovers.`,
        body: "",
      },
      cancelled: {
        subject: `Order ${o.order_number} cancelled`,
        title: "Your order was cancelled",
        intro: `Hi ${esc(name)}, order <b>${n}</b> has been cancelled.${o.payment_method === "prepaid" ? " If you paid online, your refund is being processed and we'll email you when it's done." : ""}`,
        body: "",
      },
      refunded: {
        subject: `Refund processed for order ${o.order_number}`,
        title: "Refund processed",
        intro: `Hi ${esc(name)}, we've refunded ${extra?.refundAmount ? formatINR(extra.refundAmount) : "your payment"} for order <b>${n}</b>. It usually reaches your account within 5–7 business days.`,
        body: "",
      },
    };
    const m = map[kind];
    await sendEmail({ to, subject: m.subject, html: layout(m.title, m.intro, m.body, { href: url, label: "View order" }) });

    const adminTo = serverEnv().ADMIN_NOTIFICATION_EMAIL;
    if (adminTo && (kind === "placed" || kind === "paid")) {
      await sendEmail({ to: adminTo, subject: `[New order] ${o.order_number}: ${formatINR(o.total)} (${o.payment_method})`, html: layout(`New order ${o.order_number}`, "", items) });
    }
  } catch (e) {
    console.error("[email] order email failed", kind, orderId, e);
  }
}
