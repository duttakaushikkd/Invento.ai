import type { Tenant } from "./types";

export function tenantFromPrincipal(principalId: string, actorId?: string): Tenant {
  return { orgId: principalId, actorId: actorId ?? principalId };
}
