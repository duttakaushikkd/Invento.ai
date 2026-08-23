import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description: "Agent inspects schema before mutating messy inventory data.",
  async test(t) {
    await t.send("List inventories, inspect the demo schema, then preview adding a crate with qty 3 in East. Do not commit until I confirm.");
    t.succeeded();
    t.calledTool("inspect_schema");
    t.calledTool("preview_mutation");
    t.check(t.reply, includes("preview"));
  },
});
