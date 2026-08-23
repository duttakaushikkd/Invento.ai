import { jsonHandler } from "@/lib/api";
import { listInventories } from "@/lib/inventory/engine";

export const GET = () => jsonHandler((tenant) => listInventories(tenant));
