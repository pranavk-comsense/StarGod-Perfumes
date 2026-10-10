import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { publicEnv, serverEnv } from "@/lib/env";
import { paiseToRupees } from "@/lib/money";

/**
 * Cashfree Payment Gateway (PG) REST client: server-side only.
 * Docs: https://www.cashfree.com/docs/api-reference/payments
 * Verify the API version and payload shapes against the dashboard docs when
 * credentials are added; everything gateway-specific lives in this file.
 */

export class CashfreeError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export function isCashfreeConfigured(): boolean {
  const env = serverEnv();
  return Boolean(env.CASHFREE_APP_ID && env.CASHFREE_SECRET_KEY);
}

function baseUrl() {
  return publicEnv().NEXT_PUBLIC_CASHFREE_MODE === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
}

async function request<T>(path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const env = serverEnv();
  if (!env.CASHFREE_APP_ID || !env.CASHFREE_SECRET_KEY) {
    throw new CashfreeError("Cashfree is not configured", 503, "not_configured");
  }
  const res = await fetch(`${baseUrl()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "x-api-version": env.CASHFREE_API_VERSION,
      "x-client-id": env.CASHFREE_APP_ID,
      "x-client-secret": env.CASHFREE_SECRET_KEY,
      ...(init.idempotencyKey ? { "x-idempotency-key": init.idempotencyKey } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new CashfreeError(json?.message ?? `Cashfree ${res.status}`, res.status, json?.code);
  }
  return json as T;
}

export type CfOrder = {
  cf_order_id: string;
  order_id: string;
  order_amount: number;
  order_currency: string;
  order_status: "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED" | "TERMINATION_REQUESTED";
  payment_session_id: string;
};

export type CfPayment = {
  cf_payment_id: string | number;
  order_id: string;
  payment_status: "SUCCESS" | "NOT_ATTEMPTED" | "FAILED" | "USER_DROPPED" | "VOID" | "CANCELLED" | "PENDING";
  payment_amount: number;
  payment_group?: string;
  payment_time?: string;
  payment_message?: string;
};

export type CfRefund = {
  cf_refund_id: string | number;
  refund_id: string;
  order_id: string;
  refund_amount: number;
  refund_status: "SUCCESS" | "PENDING" | "CANCELLED" | "ONHOLD";
};

export function createOrder(input: {
  orderNumber: string;
  amountPaise: number;
  customer: { id: string; name: string; email?: string | null; phone: string };
  returnUrl: string;
  notifyUrl: string;
  expiresAt: Date;
}) {
  return request<CfOrder>("/orders", {
    method: "POST",
    idempotencyKey: `order-${input.orderNumber}`,
    body: {
      order_id: input.orderNumber,
      order_amount: paiseToRupees(input.amountPaise),
      order_currency: "INR",
      customer_details: {
        customer_id: input.customer.id,
        customer_name: input.customer.name,
        customer_email: input.customer.email ?? undefined,
        customer_phone: input.customer.phone,
      },
      order_meta: { return_url: input.returnUrl, notify_url: input.notifyUrl },
      order_expiry_time: input.expiresAt.toISOString(),
    },
  });
}

export const getOrder = (orderNumber: string) => request<CfOrder>(`/orders/${encodeURIComponent(orderNumber)}`);

export const getOrderPayments = (orderNumber: string) => request<CfPayment[]>(`/orders/${encodeURIComponent(orderNumber)}/payments`);

export function createRefund(orderNumber: string, input: { refundId: string; amountPaise: number; note?: string }) {
  return request<CfRefund>(`/orders/${encodeURIComponent(orderNumber)}/refunds`, {
    method: "POST",
    idempotencyKey: input.refundId,
    body: {
      refund_id: input.refundId,
      refund_amount: paiseToRupees(input.amountPaise),
      refund_note: input.note?.slice(0, 100),
    },
  });
}

export const getRefund = (orderNumber: string, refundId: string) =>
  request<CfRefund>(`/orders/${encodeURIComponent(orderNumber)}/refunds/${encodeURIComponent(refundId)}`);

/**
 * Webhook signature: base64(HMAC-SHA256(timestamp + rawBody, secretKey)).
 * Also rejects stale timestamps to limit replay.
 */
export function verifyWebhookSignature(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  const secret = serverEnv().CASHFREE_SECRET_KEY;
  if (!secret || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  const tsMs = ts < 1e12 ? ts * 1000 : ts;
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 15 * 60 * 1000) return false;

  const expected = createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function mapRefundStatus(s: CfRefund["refund_status"] | string): "pending" | "success" | "failed" {
  if (s === "SUCCESS") return "success";
  if (s === "CANCELLED") return "failed";
  return "pending";
}
