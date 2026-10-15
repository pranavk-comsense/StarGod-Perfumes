import "server-only";
import { NextResponse } from "next/server";
import type { ShipmozoDocument } from "@/lib/shipping/shipmozo";

/** Serves a Shipmozo label/manifest: redirects to its link, or streams the PDF inline. */
export async function documentResponse(load: () => Promise<ShipmozoDocument>, filename: string) {
  try {
    const doc = await load();
    if ("url" in doc) return NextResponse.redirect(doc.url);
    return new NextResponse(new Uint8Array(doc.pdf), {
      headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${filename}"`, "cache-control": "private, no-store" },
    });
  } catch (e) {
    console.error("[shipmozo]", filename, e);
    return new NextResponse(`Couldn't get ${filename} from Shipmozo: ${e instanceof Error ? e.message : "unknown error"}`, { status: 502 });
  }
}
