import { auth } from "@clerk/nextjs/server";
import { tenantFromPrincipal } from "./identity";
import type { Tenant } from "./types";

export async function requireTenant(): Promise<Tenant> {
  try {
    const session = await auth();
    if (session.userId) {
      return tenantFromPrincipal(session.orgId ?? session.userId, session.userId);
    }
  } catch {
    // fall through to local demo tenant
  }
  return tenantFromPrincipal("local-dev");
}

export { tenantFromPrincipal };
