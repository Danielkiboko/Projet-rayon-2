import { NextResponse } from "next/server";
import { getClientApkUrl } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  const targetUrl = getClientApkUrl();
  return NextResponse.redirect(targetUrl, { status: 307 });
}
