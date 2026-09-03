import test from "node:test";
import assert from "node:assert/strict";
import { getBaseAmounts } from "../lib/pms/distributionAmounts.js";

const fixture = {
  category: "OTC", supplyUnitPrice: "720", quantity: "50000",
  minimumOrderBatchQuantity: "2", permitCompanyFee: true,
  permitCompanyFeeRate: "10", permitCompany: "테스트 허가사"
};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`);

test("batch and minimum order costs retain VAT and permit fees", () => {
  const result = getBaseAmounts(fixture);
  assert.equal(result.minimumOrderQuantity, 100000);
  close(result.permitFeeUnitPrice, 792);
  close(result.finalUnitCost, 871.2);
  close(result.finalTotal, 43560000);
  close(result.minimumOrderFinalTotal, 87120000);
  close(result.permitFeeTotalExcludingVat, 3600000);
  close(result.permitFeeTotal, 3960000);
  close(result.minimumOrderPermitFeeTotalExcludingVat, 7200000);
  close(result.minimumOrderPermitFeeTotal, 7920000);
  close(result.vatTotal + result.permitFeeTotal, result.finalTotal);
});

test("no permit fee ignores a stale rate and reports zero fee", () => {
  const result = getBaseAmounts({ ...fixture, permitCompanyFee: false });
  close(result.finalUnitCost, 792);
  assert.equal(result.permitFeeTotal, 0);
  assert.equal(result.minimumOrderPermitFeeTotal, 0);
});

test("included unknown fee cannot be separated out as zero", () => {
  const result = getBaseAmounts({ ...fixture, permitCompanyFeeRateUnknown: true });
  close(result.finalUnitCost, 792);
  assert.equal(result.permitFeeTotal, null);
  assert.equal(result.minimumOrderPermitFeeTotal, null);
});

test("missing fee rate is not a known zero fee", () => {
  const result = getBaseAmounts({ ...fixture, permitCompanyFeeRate: "" });
  assert.equal(result.permitFeeTotal, null);
  assert.equal(result.permitFeeTotalExcludingVat, null);
});

test("explicit zero fee is a known zero fee", () => {
  const result = getBaseAmounts({ ...fixture, permitCompanyFeeRate: "0" });
  assert.equal(result.permitFeeTotal, 0);
  close(result.finalUnitCost, 792);
});

test("missing quote or batch quantity does not invent fee totals", () => {
  for (const patch of [{ supplyUnitPrice: "" }, { quantity: "" }]) {
    const result = getBaseAmounts({ ...fixture, ...patch });
    assert.equal(result.finalTotal, null);
    assert.equal(result.permitFeeTotal, null);
    assert.equal(result.minimumOrderPermitFeeTotal, null);
  }
});

test("legacy minimum order defaults to one batch", () => {
  const result = getBaseAmounts({ ...fixture, minimumOrderBatchQuantity: "" });
  assert.equal(result.minimumOrderBatches, 1);
  assert.equal(result.minimumOrderPermitFeeTotal, result.permitFeeTotal);
});

test("non-OTC records do not acquire permit fees", () => {
  const result = getBaseAmounts({ ...fixture, category: "일반식품" });
  assert.equal(result.permitFeeTotal, 0);
  close(result.finalTotal, 39600000);
});

