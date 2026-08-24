import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/inventory/tenant";

export async function jsonHandler(fn: (tenant: Awaited<ReturnType<typeof requireTenant>>) => Promise<unknown>) {
  try {
    const tenant = await requireTenant();
    return NextResponse.json(await fn(tenant));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
