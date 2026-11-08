/**
 * The session's cost for a summary: "$1.234567", with " (estimate)" when part
 * of the total was priced at the fallback rate because the model has no price
 * table (SessionUsage.costEstimated). A fallback total once read $4.00 for a
 * run the AWS list priced at $2.35, with nothing to say it was a guess.
 */
export function formatSessionCost(usage: {
  totalCost: number;
  costEstimated?: boolean;
}): string {
  return `$${usage.totalCost.toFixed(6)}${usage.costEstimated ? " (estimate)" : ""}`;
}
