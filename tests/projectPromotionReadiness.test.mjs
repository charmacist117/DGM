import test from "node:test";
import assert from "node:assert/strict";

import { projectPromotionReadiness } from "../lib/pms/projectPromotion.js";

const readyItem = {
  manufacturer: "검증 제조사",
  ingredients: [{ name: "세티리진", amount: "10mg" }],
  supplyUnitPrice: "720",
  quantity: "50000",
  distributionStructure: { isConfigured: true },
  marketSizeAnalysis: { updatedAt: "2026-09-03T09:00:00.000Z" },
  marketDecisionStatus: "proceed"
};

test("프로젝트 추진 준비가 끝난 시장 분석 건을 진입 가능 상태로 판정한다", () => {
  assert.deepEqual(projectPromotionReadiness(readyItem), {
    supplyReady: true,
    distributionReady: true,
    marketReady: true,
    marketApproved: true,
    isImminent: true,
    completedCount: 3
  });
});

test("시장 분석이 진행 추진이 아니면 프로젝트 추진 대상으로 판정하지 않는다", () => {
  const readiness = projectPromotionReadiness({ ...readyItem, marketDecisionStatus: "hold" });
  assert.equal(readiness.marketApproved, false);
  assert.equal(readiness.isImminent, false);
});

test("선행 단계가 빠지면 해당 준비 상태와 전체 진입 상태를 해제한다", () => {
  const noSupply = projectPromotionReadiness({ ...readyItem, supplyUnitPrice: "" });
  const noDistribution = projectPromotionReadiness({ ...readyItem, distributionStructure: {} });
  const noMarket = projectPromotionReadiness({ ...readyItem, marketSizeAnalysis: {} });

  assert.equal(noSupply.supplyReady, false);
  assert.equal(noDistribution.distributionReady, false);
  assert.equal(noMarket.marketReady, false);
  assert.equal(noSupply.isImminent, false);
  assert.equal(noDistribution.isImminent, false);
  assert.equal(noMarket.isImminent, false);
});
