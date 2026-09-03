import test from "node:test";
import assert from "node:assert/strict";

import {
  composeDistributionReportSections,
  normalizeDistributionExportSections
} from "../lib/pms/distributionExport.js";

test("유통 구조 출력 영역은 처음에 모두 선택된다", () => {
  assert.deepEqual(normalizeDistributionExportSections(), {
    profile: true,
    pricing: true,
    comparison: true
  });
});

test("모든 선택 조합에서 선택한 영역만 순서대로 출력한다", () => {
  const sections = { profile: "제품 유통 프로파일", pricing: "판매가 및 마진 설정", comparison: "견적·경쟁제품 비교" };
  const keys = Object.keys(sections);
  for (let mask = 0; mask < 8; mask += 1) {
    const selection = Object.fromEntries(keys.map((key, index) => [key, Boolean(mask & (1 << index))]));
    assert.equal(
      composeDistributionReportSections(selection, sections),
      keys.filter((key) => selection[key]).map((key) => sections[key]).join("")
    );
  }
});
