function numberValue(value) {
  const normalized = String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!normalized || normalized === "-" || normalized === "." || normalized === "-.") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeProjectPromotion(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    expectedLaunchDate: String(source.expectedLaunchDate || ""),
    additionalExpectedCost: String(source.additionalExpectedCost || ""),
    costMemo: String(source.costMemo || ""),
    linkedProjectId: source.linkedProjectId ?? "",
    updatedAt: String(source.updatedAt || "")
  };
}

export function projectPromotionReadiness(item = {}) {
  const ingredientReady = (Array.isArray(item.ingredients) ? item.ingredients : [])
    .some((ingredient) => String(ingredient?.name || "").trim());
  const supplyReady = Boolean(
    String(item.manufacturer || "").trim()
    && ingredientReady
    && (numberValue(item.supplyUnitPrice) ?? 0) > 0
    && (numberValue(item.quantity) ?? 0) > 0
  );
  const distributionReady = item.distributionStructure?.isConfigured === true;
  const marketReady = Boolean(String(item.marketSizeAnalysis?.updatedAt || "").trim());
  return {
    supplyReady,
    distributionReady,
    marketReady,
    isImminent: supplyReady && distributionReady && marketReady,
    completedCount: [supplyReady, distributionReady, marketReady].filter(Boolean).length
  };
}

export function calculateProjectPromotionCost(item = {}) {
  const unitPrice = numberValue(item.supplyUnitPrice);
  const quantity = numberValue(item.quantity);
  if (unitPrice === null || quantity === null || quantity <= 0) {
    return { finalUnitCost: null, minimumOrderBatches: null, initialProductionCost: null };
  }
  const minimumOrderBatches = Math.max(1, Math.ceil(numberValue(item.minimumOrderBatchQuantity) ?? 1));
  const permitFeeRate = numberValue(item.permitCompanyFeeRate);
  const knownPermitFee = item.category === "OTC"
    && item.permitCompanyFee
    && !item.permitCompanyFeeRateUnknown
    && permitFeeRate !== null;
  const finalUnitCost = unitPrice * 1.1 * (knownPermitFee ? 1 + (permitFeeRate / 100) : 1);
  return {
    finalUnitCost,
    minimumOrderBatches,
    initialProductionCost: finalUnitCost * quantity * minimumOrderBatches
  };
}

export function projectPromotionTotalExpectedCost(item = {}) {
  const automatic = calculateProjectPromotionCost(item).initialProductionCost;
  if (automatic === null) return null;
  return automatic + (numberValue(item.projectPromotion?.additionalExpectedCost) ?? 0);
}
