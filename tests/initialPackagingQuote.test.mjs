import test from "node:test";
import assert from "node:assert/strict";
import { initialPackagingQuote } from "../lib/pms/supplyCostBreakdown.js";

test("initial quote keeps separately purchased packaging distinct from production", () => {
  assert.deepEqual(initialPackagingQuote({ quantity: "3000", supplyUnitPrice: "3340", extraPackagingQuantity: "2000", extraPackagingUnitPrice: "2230" }), { packagingTotal: 4460000, total: 14480000 });
  assert.equal(initialPackagingQuote({ quantity: "3000", supplyUnitPrice: "3340" }).total, null);
});
