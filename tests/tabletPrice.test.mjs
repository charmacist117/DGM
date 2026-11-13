import test from "node:test";
import assert from "node:assert/strict";
import { tabletsPerPack, convertTabletPrice } from "../lib/pms/tabletPrice.js";

test("tablet and pack prices convert in both directions only for unambiguous tablet quantities", () => {
  assert.equal(tabletsPerPack("20", "정"), 20);
  assert.equal(tabletsPerPack("20정", "PTP"), 20);
  assert.equal(tabletsPerPack("20", "병"), null);
  assert.equal(tabletsPerPack("10정 × 3", "PTP"), null);
  assert.equal(convertTabletPrice("900", 20, "tablet"), 45);
  assert.equal(convertTabletPrice("45", 20, "pack"), 900);
  assert.equal(convertTabletPrice("", 20, "pack"), null);
});
