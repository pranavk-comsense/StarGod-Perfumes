import "server-only";
import { serverEnv } from "@/lib/env";

export type Email = { to: string | string[]; subject: string; html: string; replyTo?: string };

/**
 * Sends through Resend when RESEND_API_KEY is set; otherwise logs, so local
 * development and pre-launch environments never fail on email.
 * Never throws: email problems must not break orders.
 */
export async function sendEmail(email: Email): Promise<void> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY) {
    console.info(`[email:dev] to=${[email.to].flat().join(",")} subject="${email.subject}"`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: email.to, subject: email.subject, html: email.html, reply_to: email.replyTo }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("[email] resend", res.status, await res.text());
  } catch (e) {
    console.error("[email] failed", e);
  }
}
