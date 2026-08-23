import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jsonHandler } from "@/lib/api";
import { googleAuthUrl } from "@/lib/inventory/sheets-store";

export const GET = () =>
  jsonHandler(async (tenant) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new Error("Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
    }
    const state = tenant.orgId;
    (await cookies()).set("invento_google_oauth", state, { httpOnly: true, sameSite: "lax", maxAge: 600 });
    return { url: googleAuthUrl(state) };
  });
