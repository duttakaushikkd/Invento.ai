import type { MutationOp } from "./types";

export const DEFAULT_BULK_CAP = 50;

export type PolicyDecision = {
  requireConfirmation: boolean;
  capped: boolean;
  reason: string;
};

export function mutationPolicy(op: MutationOp, count: number, autoApplySmallWrites = false): PolicyDecision {
  if (count > DEFAULT_BULK_CAP) {
    return {
      requireConfirmation: true,
      capped: true,
      reason: `Bulk ${op} of ${count} rows exceeds the ${DEFAULT_BULK_CAP} row cap. Confirm as bulk.`,
    };
  }
  if (op === "delete") {
    return {
      requireConfirmation: true,
      capped: false,
      reason: "Deletes always require confirmation.",
    };
  }
  if (autoApplySmallWrites && count === 1) {
    return {
      requireConfirmation: false,
      capped: false,
      reason: "Org allows auto-apply for a single create/update.",
    };
  }
  return {
    requireConfirmation: true,
    capped: false,
    reason: "Writes require preview then confirm.",
  };
}
