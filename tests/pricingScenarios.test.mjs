import test from "node:test";
import assert from "node:assert/strict";
import { normalizePricingScenario, calculateBonusPromotion, bonusPromotionQuantityLabel, pricingScenarioGroup } from "../lib/pms/pricingScenarios.js";
import { calculateMarketAnalysis } from "../lib/pms/marketAnalysis.js";

const calculate = (patch = {}) => calculateBonusPromotion({
  unitCost: 800, sellingPrice: 1000, paidQuantity: "10", bonusQuantity: "2", ...patch
});
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`);

test("10+2 charges only 10 units but includes the cost of all 12", () => {
  const result = calculate();
  assert.equal(result.totalQuantity, 12);
  assert.equal(result.purchaseTotal, 10000);
  assert.equal(result.totalCost, 9600);
  assert.equal(result.totalMargin, 400);
  close(result.effectiveUnitPrice, 10000 / 12);
  close(result.marginPerUnit, 400 / 12);
  close(result.marginRate, 4);
});
test("zero bonus keeps the ordinary unit price and margin", () => {
  const result = calculate({ bonusQuantity: 0 });
  assert.equal(result.effectiveUnitPrice, 1000);
  assert.equal(result.marginRate, 20);
});
test("loss-making promotions retain negative margins", () => {
  const result = calculate({ bonusQuantity: 10 });
  assert.equal(result.totalMargin, -6000);
  assert.equal(result.marginRate, -60);
});
for (const patch of [{ paidQuantity: "" }, { bonusQuantity: "" }, { paidQuantity: 0 }, { paidQuantity: -1 }, { bonusQuantity: -1 }, { paidQuantity: 1.5 }, { bonusQuantity: 0.5 }, { paidQuantity: Number.MAX_SAFE_INTEGER }]) {
  test(`invalid quantities do not project money: ${JSON.stringify(patch)}`, () => {
    const result = calculate(patch);
    assert.equal(result.validQuantities, false);
    for (const key of ["totalQuantity", "purchaseTotal", "totalCost", "effectiveUnitPrice", "totalMargin", "marginRate"]) assert.equal(result[key], null);
  });
}
test("missing price is not mistaken for a free promotion", () => {
  const result = calculate({ sellingPrice: null });
  assert.equal(result.purchaseTotal, null);
  assert.equal(result.effectiveUnitPrice, null);
  assert.equal(result.marginRate, null);
});
test("missing cost does not invent profit", () => {
  const result = calculate({ unitCost: "" });
  assert.equal(result.totalCost, null);
  assert.equal(result.totalMargin, null);
  assert.equal(result.purchaseTotal, 10000);
});
test("zero price has no percentage denominator", () => {
  const result = calculate({ sellingPrice: 0 });
  assert.equal(result.effectiveUnitPrice, 0);
  assert.equal(result.totalMargin, -9600);
  assert.equal(result.marginRate, null);
});
test("comma-separated values are accepted", () => {
  assert.equal(calculate({ paidQuantity: "1,000", bonusQuantity: "200" }).totalQuantity, 1200);
});
test("bonus type, counts and empty draft name survive normalization and JSON persistence", () => {
  const original = normalizePricingScenario({ id: "b1", label: "", scenarioType: "bonus", minimumQuantity: 10, bonusQuantity: 2 });
  const saved = normalizePricingScenario(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(saved, original);
  assert.equal(saved.scenarioType, "bonus");
  assert.equal(saved.bonusQuantity, "2");
  assert.equal(saved.label, "");
});
test("bundle ordering survives the same save pipeline", () => {
  const saved = normalizePricingScenario({ scenarioType: "bundle", bundleOrder: 3, bundleItemIds: [1, 2] });
  assert.equal(normalizePricingScenario(saved).bundleOrder, 3);
  assert.deepEqual(saved.bundleItemIds, ["1", "2"]);
});
test("bonus and ordinary tabs share a reorder group but bundles do not", () => {
  assert.equal(pricingScenarioGroup({ scenarioType: "single" }), pricingScenarioGroup({ scenarioType: "bonus" }));
  assert.notEqual(pricingScenarioGroup({ scenarioType: "bonus" }), pricingScenarioGroup({ scenarioType: "bundle" }));
});
test("market analysis consumes the effective bonus-inclusive unit price", () => {
  const item = {
    supplyUnitPrice: "800", quantity: "1000", category: "OTC",
    distributionStructure: { pricingScenarios: [{ id: "b", scenarioType: "bonus", minimumQuantity: "10", bonusQuantity: "2", chamyaksaMarginRate: "20" }] }
  };
  const result = calculateMarketAnalysis(item);
  close(result.distributionSellingPrice, 11000 / 12);
  close(result.chamyaksaExpectedMarginRate, 4);
});
test("report quantity labels explicitly distinguish paid and free units", () => {
  assert.equal(bonusPromotionQuantityLabel({ minimumQuantity: "10", bonusQuantity: "2" }), "10개 구매 + 2개 증정 (총 12개)");
});

