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
    progressDecision: normalizePromotionProgressDecision(source.progressDecision),
    finalDecision: ["proceed", "hold"].includes(source.finalDecision) ? source.finalDecision : "",
    finalDecisionAt: String(source.finalDecisionAt || ""),
    followUpNote: "",
    followUps: (Array.isArray(source.followUps) ? source.followUps : []).map((entry) => ({
      id: String(entry?.id || ""),
      status: normalizePromotionProgressDecision(entry?.status),
      note: String(entry?.note || ""),
      createdAt: String(entry?.createdAt || "")
    })).filter((entry) => entry.status && entry.createdAt),
    updatedAt: String(source.updatedAt || "")
  };
}

export function promotionFinalDecisionLabel(value) {
  if (value === "proceed") return "최종 진행";
  if (value === "hold") return "보류";
  return "미결정";
}

export const PROMOTION_PROGRESS_OPTIONS = [
  { value: "", label: "미결정", color: "#64748b", background: "#f1f5f9", borderColor: "#cbd5e1" },
  { value: "executive_report", label: "경영진 보고", color: "#1d4ed8", background: "#eff6ff", borderColor: "#bfdbfe" },
  { value: "supplement", label: "내용 보완", color: "#b45309", background: "#fffbeb", borderColor: "#fde68a" },
  { value: "hold", label: "진행 보류", color: "#7c3aed", background: "#faf5ff", borderColor: "#ddd6fe" },
  { value: "stop", label: "중단", color: "#b91c1c", background: "#fef2f2", borderColor: "#fecaca" }
];

const PROMOTION_PROGRESS_ALIASES = Object.fromEntries(PROMOTION_PROGRESS_OPTIONS.flatMap((option) => [
  [option.value, option.value],
  [option.label, option.value]
]));

export function normalizePromotionProgressDecision(value) {
  return PROMOTION_PROGRESS_ALIASES[String(value ?? "").trim()] ?? "";
}

export function promotionProgressOption(value) {
  const normalized = normalizePromotionProgressDecision(value);
  return PROMOTION_PROGRESS_OPTIONS.find((option) => option.value === normalized) || PROMOTION_PROGRESS_OPTIONS[0];
}

export function promotionProgressLabel(value) {
  return promotionProgressOption(value).label;
}

export function promotionProgressBadgeStyle(value) {
  const option = promotionProgressOption(value);
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 24,
    padding: "3px 8px", border: `1px solid ${option.borderColor}`, borderRadius: 5,
    background: option.background, color: option.color, fontSize: 12, fontWeight: 900, whiteSpace: "nowrap"
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
    marketApproved: item.marketDecisionStatus === "proceed",
    isImminent: supplyReady && distributionReady && marketReady && item.marketDecisionStatus === "proceed",
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
