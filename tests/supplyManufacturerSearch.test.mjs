import test from "node:test";
import assert from "node:assert/strict";
import { matchesManufacturerSearch } from "../lib/pms/supplyManufacturerSearch.js";

test("미입력 search matches only items without a manufacturer", () => {
  assert.equal(matchesManufacturerSearch({ manufacturer: "" }, "미입력"), true);
  assert.equal(matchesManufacturerSearch({ manufacturer: "  " }, "미입력"), true);
  assert.equal(matchesManufacturerSearch({ manufacturer: "노바엠헬스케어" }, "미입력"), false);
});

test("ordinary manufacturer search remains case-insensitive substring matching", () => {
  assert.equal(matchesManufacturerSearch({ manufacturer: "Nova Healthcare" }, "health"), true);
  assert.equal(matchesManufacturerSearch({ manufacturer: "Nova Healthcare" }, "unknown"), false);
  assert.equal(matchesManufacturerSearch({ manufacturer: "Nova Healthcare" }, ""), true);
});
