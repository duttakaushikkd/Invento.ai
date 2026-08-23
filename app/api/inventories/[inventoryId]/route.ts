import { jsonHandler } from "@/lib/api";
import { inspectInventory } from "@/lib/inventory/engine";

export const GET = async (_request: Request, context: { params: Promise<{ inventoryId: string }> }) => {
  const { inventoryId } = await context.params;
  return jsonHandler((tenant) => inspectInventory(tenant, inventoryId));
};
