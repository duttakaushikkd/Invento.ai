import { tenantFromPrincipal } from "./identity";
import type { Tenant } from "./types";

export async function requireTenant(): Promise<Tenant> {
  return tenantFromPrincipal("local-dev");
}

export { tenantFromPrincipal };
