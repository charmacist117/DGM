import test from "node:test";
import assert from "node:assert/strict";
import { tabletsPerPack, convertTabletPrice, adjustedPackPriceToBase } from "../lib/pms/tabletPrice.js";
import { getPermitFeeRates } from "../lib/pms/distributionAmounts.js";

test("tablet and pack prices convert in both directions only for unambiguous tablet quantities", () => {
  assert.equal(tabletsPerPack("20", "정"), 20);
  assert.equal(tabletsPerPack("20정", "PTP"), 20);
  assert.equal(tabletsPerPack("20", "병"), null);
  assert.equal(tabletsPerPack("10정 × 3", "PTP"), null);
  assert.equal(convertTabletPrice("900", 20, "tablet"), 45);
  assert.equal(convertTabletPrice("45", 20, "pack"), 900);
  assert.equal(convertTabletPrice("", 20, "pack"), null);
});

test("fee-inclusive and VAT-inclusive prices reverse to the original pack price", () => {
  for (const type of ["markup", "margin"]) {
    const multiplier = getPermitFeeRates("10", type).multiplier;
    const feePack = 1200 * multiplier;
    const vatTablet = convertTabletPrice(feePack * 1.1, 20, "tablet");
    assert.ok(Math.abs(Number(adjustedPackPriceToBase(feePack, multiplier)) - 1200) < 0.000001);
    assert.ok(Math.abs(Number(adjustedPackPriceToBase(convertTabletPrice(vatTablet, 20, "pack"), multiplier * 1.1)) - 1200) < 0.000001);
  }
  assert.equal(adjustedPackPriceToBase(100, null), null);
});
