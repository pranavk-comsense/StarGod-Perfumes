import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLabel } from "@/lib/shipping/shipmozo";
import { documentResponse } from "@/lib/shipping/document-response";

/** Shipping label for a Shipmozo AWB: redirects to Shipmozo's link or streams the PDF. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/admin/shipments/label/[awb]">) {
  await requirePermission("shipments.manage");
  const { awb } = await ctx.params;
  const admin = createAdminClient();
  const [{ data: shipment }, { data: ret }] = await Promise.all([
    admin.from("shipments").select("id").eq("awb", awb).eq("provider", "shipmozo").maybeSingle(),
    admin.from("return_shipments").select("id").eq("awb", awb).maybeSingle(),
  ]);
  if (!shipment && !ret) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return documentResponse(() => getLabel(awb), `label-${awb}.pdf`);
}
