import { jsonHandler } from "@/lib/api";
import { previewMutation } from "@/lib/inventory/engine";
import type { MutationOp } from "@/lib/inventory/types";

export const POST = async (request: Request) => {
  const body = (await request.json()) as {
    inventoryId: string;
    op: MutationOp;
    recordId?: string;
    data?: Record<string, string | number | boolean | null>;
    idempotencyKey?: string;
  };
  return jsonHandler((tenant) => previewMutation(tenant, body));
};
