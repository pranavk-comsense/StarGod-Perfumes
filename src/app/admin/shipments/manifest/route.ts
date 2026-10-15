import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateManifest } from "@/lib/shipping/shipmozo";
import { documentResponse } from "@/lib/shipping/document-response";

/** Handover manifest for Shipmozo parcels still awaiting pickup (status "shipped", max 25). */
export async function GET() {
  await requirePermission("shipments.manage");
  const { data } = await createAdminClient()
    .from("shipments")
    .select("awb")
    .eq("provider", "shipmozo")
    .eq("is_active", true)
    .eq("status", "shipped")
    .not("awb", "is", null)
    .order("created_at")
    .limit(25);
  const awbs = (data ?? []).map((s) => s.awb as string);
  if (!awbs.length) return NextResponse.json({ error: "No parcels are waiting for pickup." }, { status: 404 });
  return documentResponse(() => generateManifest(awbs), `manifest-${new Date().toISOString().slice(0, 10)}.pdf`);
}
