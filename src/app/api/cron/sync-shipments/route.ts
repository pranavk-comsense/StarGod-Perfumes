import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { isShipmozoConfigured } from "@/lib/shipping/shipmozo";
import { syncActiveShipments, syncReturns } from "@/lib/shipping/booking";

/**
 * Pulls courier scans from Shipmozo for in-flight shipments (delivered / RTO
 * move the order along) and open return pickups. Scheduled in vercel.json; authenticated with CRON_SECRET.
 */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = serverEnv().CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isShipmozoConfigured()) return NextResponse.json({ skipped: "shipmozo_not_configured" });
  const [shipments, returns] = await Promise.all([syncActiveShipments(100), syncReturns(50)]);
  return NextResponse.json({ shipments, returns });
}
