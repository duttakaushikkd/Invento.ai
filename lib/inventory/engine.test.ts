import { describe, expect, it } from "vitest";
import { inferSchema, matchesFilter, validateAgainstSchema } from "./schema";
import { MemoryInventoryStore } from "./memory-store";
import { previewMutation, commitMutation, listInventories } from "./engine";

const tenant = { orgId: "test-org", actorId: "tester" };

describe("schema inference", () => {
  it("infers types from messy headers and mixed values", () => {
    const schema = inferSchema(
      ["SKU Code", "Qty", "Status", ""],
      [
        ["A-1", "12", "active", "x"],
        ["A-2", "4", "active", "y"],
        ["A-3", "0", "backorder", "z"],
        ["", "2", "active", ""],
      ],
    );
    expect(schema.fields.some((field) => field.name.toLowerCase().includes("sku"))).toBe(true);
    const qty = schema.fields.find((field) => field.name.toLowerCase().includes("qty"));
    expect(qty?.type).toBe("number");
    expect(schema.primaryKey).toBeTruthy();
  });

  it("rejects unknown columns", () => {
    const schema = inferSchema(["sku", "name"], [["A", "Desk"]]);
    expect(() => validateAgainstSchema(schema, { color: "red" }, "create")).toThrow();
  });

  it("matches contains filters without case sensitivity", () => {
    expect(matchesFilter({ name: "Walnut Desk" }, "name", "contains", "walnut")).toBe(true);
  });
});

describe("memory inventory + confirmation", () => {
  it("requires preview then commit for writes", async () => {
    const inventories = await listInventories(tenant);
    const demo = inventories[0];
    expect(demo).toBeTruthy();
    const preview = await previewMutation(tenant, {
      inventoryId: demo!.id,
      op: "create",
      data: { sku: "SKU-9", name: "Crate", qty: 3, warehouse: "East", status: "active" },
    });
    expect(preview.status).toBe("previewed");
    const committed = await commitMutation(tenant, preview.id);
    expect(committed).toBeTruthy();
  });

  it("stores records with a stable id even when sku is blank", async () => {
    const store = new MemoryInventoryStore(["sku", "name"], [["", "Loose item"], ["X", "Named"]]);
    const page = await store.query();
    expect(page.items.every((item) => item.id.length > 0)).toBe(true);
  });
});
