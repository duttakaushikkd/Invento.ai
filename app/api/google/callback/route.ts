import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { saveGoogleConnection } from "@/lib/inventory/engine";
import { exchangeGoogleCode } from "@/lib/inventory/sheets-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = (await cookies()).get("invento_google_oauth")?.value;
  if (!code || !state || state !== expected) {
    return NextResponse.redirect(new URL("/dashboard?google=error", url.origin));
  }
  const { tokens, email } = await exchangeGoogleCode(code);
  await saveGoogleConnection({ orgId: state, actorId: state }, tokens, email);
  return NextResponse.redirect(new URL("/dashboard?google=connected", url.origin));
}
