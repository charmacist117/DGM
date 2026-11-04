import test from "node:test";
import assert from "node:assert/strict";
import { supplyIngredientCsvCells } from "../lib/pms/supplyIngredientCsv.js";

test("ingredient fields stay in aligned multiline cells for one product row", () => {
  assert.deepEqual(supplyIngredientCsvCells([
    { name: "성분A", content: "100mg", origin: "한국", brand: "브랜드A", kilogramPriceRange: "1,000원" },
    { name: "성분B", content: "5mg", origin: "미국", brand: "브랜드B", kilogramPriceRange: "2,000원" }
  ]), [
    "성분A\n성분B",
    "100mg\n5mg",
    "한국\n미국",
    "브랜드A\n브랜드B",
    "1,000원\n2,000원"
  ]);
});

test("empty ingredient rows are omitted", () => {
  assert.deepEqual(supplyIngredientCsvCells([{}, { name: "성분A", content: "10mg" }]), ["성분A", "10mg", "", "", ""]);
});
