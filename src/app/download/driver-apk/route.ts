import { NextResponse } from "next/server";
import { getDriverApkUrl } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  const targetUrl = getDriverApkUrl();
  return NextResponse.redirect(targetUrl, { status: 307 });
}
