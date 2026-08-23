import { jsonHandler } from "@/lib/api";
import { commitMutation } from "@/lib/inventory/engine";

export const POST = async (_request: Request, context: { params: Promise<{ mutationId: string }> }) => {
  const { mutationId } = await context.params;
  return jsonHandler((tenant) => commitMutation(tenant, mutationId));
};
