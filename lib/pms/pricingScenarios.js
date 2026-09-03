function numberOrNull(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

export function normalizePricingScenario(value = {}, fallbackId = "pricing_default", fallbackLabel = "기본") {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    id: source.id ?? fallbackId,
    label: String(source.label ?? fallbackLabel),
    scenarioType: ["bundle", "bonus"].includes(source.scenarioType) ? source.scenarioType : "single",
    minimumQuantity: String(source.minimumQuantity ?? source.minQuantity ?? ""),
    bonusQuantity: String(source.bonusQuantity ?? ""),
    chamyaksaMarginRate: String(source.chamyaksaMarginRate ?? ""),
    pharmacySellingPrice: String(source.pharmacySellingPrice ?? ""),
    bundleItemIds: (Array.isArray(source.bundleItemIds) ? source.bundleItemIds : []).map(String),
    bundleSellingPrice: String(source.bundleSellingPrice ?? ""),
    bundleOrder: numberOrNull(source.bundleOrder)
  };
}

export function pricingScenarioGroup(scenario) {
  return scenario?.scenarioType === "bundle" ? "bundle" : "single";
}

export function calculateBonusPromotion({ unitCost, sellingPrice, paidQuantity, bonusQuantity } = {}) {
  const paid = numberOrNull(paidQuantity);
  const bonus = numberOrNull(bonusQuantity);
  const cost = numberOrNull(unitCost);
  const price = numberOrNull(sellingPrice);
  const validQuantities = Number.isSafeInteger(paid) && paid > 0
    && Number.isSafeInteger(bonus) && bonus >= 0
    && Number.isSafeInteger(paid + bonus);
  const totalQuantity = validQuantities ? paid + bonus : null;
  const purchaseTotal = validQuantities && price !== null && price >= 0 ? price * paid : null;
  const totalCost = validQuantities && cost !== null && cost >= 0 ? cost * totalQuantity : null;
  const effectiveUnitPrice = purchaseTotal !== null ? purchaseTotal / totalQuantity : null;
  const totalMargin = purchaseTotal !== null && totalCost !== null ? purchaseTotal - totalCost : null;
  return {
    validQuantities,
    paidQuantity: paid,
    bonusQuantity: bonus,
    totalQuantity,
    purchaseTotal,
    totalCost,
    effectiveUnitPrice,
    totalMargin,
    marginPerUnit: totalMargin !== null ? totalMargin / totalQuantity : null,
    marginRate: totalMargin !== null && purchaseTotal > 0 ? totalMargin / purchaseTotal * 100 : null
  };
}

export function bonusPromotionQuantityLabel(scenario) {
  const { validQuantities, paidQuantity, bonusQuantity, totalQuantity } = calculateBonusPromotion({
    paidQuantity: scenario?.minimumQuantity,
    bonusQuantity: scenario?.bonusQuantity
  });
  return validQuantities
    ? `${paidQuantity.toLocaleString("ko-KR")}개 구매 + ${bonusQuantity.toLocaleString("ko-KR")}개 증정 (총 ${totalQuantity.toLocaleString("ko-KR")}개)`
    : "유상/증정 수량 미입력 또는 확인 필요";
}

