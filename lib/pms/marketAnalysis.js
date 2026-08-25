function numberValue(value) {
  const normalized = String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!normalized || normalized === "-" || normalized === "." || normalized === "-.") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateSellingPriceFromMarginRate(unitCost, marginRate) {
  const normalizedUnitCost = numberValue(unitCost);
  const normalizedMarginRate = numberValue(marginRate);
  if (
    normalizedUnitCost === null
    || normalizedMarginRate === null
    || normalizedMarginRate < 0
    || normalizedMarginRate >= 100
  ) {
    return null;
  }
  return normalizedUnitCost / (1 - (normalizedMarginRate / 100));
}

function defaultMarketYears() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, index) => ({
    id: `market_year_${index + 1}`,
    year: String(currentYear - 5 + index),
    productionThousandKrw: "",
    importUsd: ""
  }));
}

export const MARKET_ANALYSIS_DEFAULTS = Object.freeze({
  nationwidePharmacyCount: "",
  chamyaksaPharmacyCount: "",
  franchisePenetrationRate: "",
  chamyaksaSellingPriceAdjustmentRate: "0",
  manufacturerSellingPriceAdjustmentRate: "0",
  annualInterestRate: "4"
});

export const MARKET_ANALYSIS_CONDITION_FIELDS = Object.freeze(Object.keys(MARKET_ANALYSIS_DEFAULTS));

export function normalizeMarketAnalysisDefaults(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(MARKET_ANALYSIS_CONDITION_FIELDS.map((field) => [
    field,
    String(source[field] ?? MARKET_ANALYSIS_DEFAULTS[field])
  ]));
}

function normalizeMarketYear(value = {}, fallback = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const includeSource = source.includeInGrowthRate ?? source.includeInCagr;
  const includeInGrowthRate = includeSource === undefined
    ? true
    : !["0", "false", "no", "off"].includes(String(includeSource).trim().toLowerCase());
  return {
    id: source.id ?? fallback.id ?? `market_year_${Date.now()}`,
    year: String(source.year ?? fallback.year ?? ""),
    productionThousandKrw: String(source.productionThousandKrw ?? source.productionAmount ?? ""),
    importUsd: String(source.importUsd ?? source.importAmount ?? ""),
    includeInGrowthRate
  };
}

export function normalizeMarketSizeAnalysis(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const defaults = defaultMarketYears();
  const sourceYears = Array.isArray(source.marketYears) ? source.marketYears.slice(0, 5) : [];
  const marketYears = defaults.map((fallback, index) => normalizeMarketYear(sourceYears[index], fallback));
  return {
    exchangeRate: String(source.exchangeRate ?? "1350"),
    nationwidePharmacyCount: String(source.nationwidePharmacyCount ?? ""),
    chamyaksaPharmacyCount: String(source.chamyaksaPharmacyCount ?? ""),
    franchisePenetrationRate: String(source.franchisePenetrationRate ?? ""),
    chamyaksaSellingPriceAdjustmentRate: String(
      source.chamyaksaSellingPriceAdjustmentRate ?? source.supplyPriceAdjustmentRate ?? "0"
    ),
    manufacturerSellingPriceAdjustmentRate: String(source.manufacturerSellingPriceAdjustmentRate ?? "0"),
    adjustedUnitCostOverride: String(source.adjustedUnitCostOverride ?? ""),
    annualInterestRate: String(source.annualInterestRate ?? "4"),
    pricingScenarioId: String(source.pricingScenarioId ?? ""),
    conditionMode: source.conditionMode === "default" || source.conditionMode === "custom"
      ? source.conditionMode
      : (source.updatedAt ? "custom" : "default"),
    marketYears,
    updatedAt: String(source.updatedAt || "")
  };
}

export function applyMarketAnalysisDefaults(value = {}, defaults = {}) {
  const analysis = normalizeMarketSizeAnalysis(value);
  if (analysis.conditionMode !== "default") return analysis;
  return {
    ...analysis,
    ...normalizeMarketAnalysisDefaults(defaults),
    pricingScenarioId: "",
    conditionMode: "default"
  };
}

export function marketAnalysisMatchesDefaults(value = {}, defaults = {}) {
  const analysis = normalizeMarketSizeAnalysis(value);
  const normalizedDefaults = normalizeMarketAnalysisDefaults(defaults);
  return MARKET_ANALYSIS_CONDITION_FIELDS.every((field) => {
    const analysisNumber = numberValue(analysis[field]);
    const defaultNumber = numberValue(normalizedDefaults[field]);
    if (analysisNumber === null || defaultNumber === null) {
      return String(analysis[field] || "").trim() === String(normalizedDefaults[field] || "").trim();
    }
    return analysisNumber === defaultNumber;
  })
    && !String(analysis.adjustedUnitCostOverride || "").trim()
    && !String(analysis.pricingScenarioId || "").trim();
}

function supplyUnitCost(item = {}) {
  const unitPrice = numberValue(item.supplyUnitPrice);
  if (unitPrice === null) return null;
  const permitFeeRate = numberValue(item.permitCompanyFeeRate);
  const knownPermitFee = item.category === "OTC"
    && item.permitCompanyFee
    && !item.permitCompanyFeeRateUnknown
    && permitFeeRate !== null;
  return unitPrice * 1.1 * (knownPermitFee ? 1 + (permitFeeRate / 100) : 1);
}

function calculatePeriodCagr(populatedYears, periodLength = populatedYears.length) {
  if (periodLength < 2 || populatedYears.length < periodLength) return null;
  const periodYears = populatedYears.slice(-periodLength);
  const earliestYear = periodYears[0];
  const latestYear = periodYears.at(-1);
  const yearGap = latestYear.year - earliestYear.year;
  if (yearGap <= 0 || earliestYear.totalKrw <= 0) return null;
  return ((latestYear.totalKrw / earliestYear.totalKrw) ** (1 / yearGap) - 1) * 100;
}

export function calculateBatchFinance({
  demandUnits,
  batchQuantity,
  minimumOrderBatches,
  unitCost,
  annualInterestRate
} = {}) {
  const normalizedDemandUnits = numberValue(demandUnits);
  const normalizedBatchQuantity = numberValue(batchQuantity);
  const normalizedMinimumOrderBatches = Math.max(1, Math.ceil(numberValue(minimumOrderBatches) ?? 1));
  const normalizedUnitCost = numberValue(unitCost);
  const normalizedInterestRate = numberValue(annualInterestRate);
  const exactBatches = normalizedDemandUnits !== null && normalizedBatchQuantity && normalizedBatchQuantity > 0
    ? normalizedDemandUnits / normalizedBatchQuantity
    : null;
  const requiredBatches = exactBatches === null ? null : Math.ceil(exactBatches);
  const orderBatchCount = requiredBatches === null
    ? null
    : Math.max(requiredBatches, normalizedMinimumOrderBatches);
  const minimumOrderQuantity = normalizedBatchQuantity !== null
    ? normalizedMinimumOrderBatches * normalizedBatchQuantity
    : null;
  const orderQuantity = orderBatchCount !== null && normalizedBatchQuantity !== null
    ? orderBatchCount * normalizedBatchQuantity
    : null;
  const depletionMonthsPerBatch = normalizedDemandUnits && orderQuantity
    ? (orderQuantity / normalizedDemandUnits) * 12
    : null;
  const annualDepletionRatePercent = normalizedDemandUnits !== null && orderQuantity
    ? Math.min(100, (normalizedDemandUnits / orderQuantity) * 100)
    : null;
  const batchCapital = normalizedUnitCost !== null && orderQuantity !== null
    ? normalizedUnitCost * orderQuantity
    : null;
  const depletionYears = depletionMonthsPerBatch !== null
    ? depletionMonthsPerBatch / 12
    : null;
  const annualFinanceMonths = depletionMonthsPerBatch !== null
    ? Math.min(12, depletionMonthsPerBatch)
    : null;
  const annualAverageInventoryRatio = depletionYears && depletionYears > 0
    ? (depletionYears <= 1
        ? depletionYears / 2
        : 1 - (1 / (2 * depletionYears)))
    : null;
  const averageInventoryUnits = orderQuantity !== null && annualAverageInventoryRatio !== null
    ? orderQuantity * annualAverageInventoryRatio
    : null;
  const averageInventoryCapital = averageInventoryUnits !== null && normalizedUnitCost !== null
    ? averageInventoryUnits * normalizedUnitCost
    : null;
  const annualFinanceCost = averageInventoryCapital !== null && normalizedInterestRate !== null
    ? averageInventoryCapital * (normalizedInterestRate / 100)
    : null;
  const totalFinanceCost = batchCapital !== null
    && depletionMonthsPerBatch !== null
    && normalizedInterestRate !== null
    ? batchCapital
      * 0.5
      * (depletionMonthsPerBatch / 12)
      * (normalizedInterestRate / 100)
    : null;

  return {
    demandUnits: normalizedDemandUnits,
    batchQuantity: normalizedBatchQuantity,
    minimumOrderBatches: normalizedMinimumOrderBatches,
    minimumOrderQuantity,
    exactBatches,
    requiredBatches,
    orderBatchCount,
    orderQuantity,
    depletionMonthsPerBatch,
    annualDepletionRatePercent,
    annualFinanceMonths,
    batchCapital,
    averageInventoryCapital,
    annualInterestRate: normalizedInterestRate,
    annualFinanceCost,
    totalFinanceCost
  };
}

export function calculateMarketAnalysis(item = {}, rawAnalysis = {}, rawDefaults = {}) {
  const sourceItem = item && typeof item === "object" && !Array.isArray(item) ? item : {};
  const analysis = applyMarketAnalysisDefaults(rawAnalysis, rawDefaults);
  const exchangeRate = numberValue(analysis.exchangeRate);
  const yearResults = analysis.marketYears
    .map((entry) => {
      const year = numberValue(entry.year);
      const productionThousandKrw = numberValue(entry.productionThousandKrw);
      const importUsd = numberValue(entry.importUsd);
      const productionKrw = productionThousandKrw === null ? 0 : productionThousandKrw * 1000;
      const importKrw = importUsd === null || exchangeRate === null ? 0 : importUsd * exchangeRate;
      return {
        ...entry,
        year,
        productionKrw,
        importKrw,
        totalKrw: productionKrw + importKrw
      };
    })
    .sort((left, right) => (left.year ?? 0) - (right.year ?? 0));

  const populatedYears = yearResults.filter((entry) => entry.year !== null && entry.totalKrw > 0);
  const growthYears = populatedYears.filter((entry) => entry.includeInGrowthRate);
  const latestYear = populatedYears.at(-1) || null;
  const averageMarketKrw = populatedYears.length
    ? populatedYears.reduce((sum, entry) => sum + entry.totalKrw, 0) / populatedYears.length
    : null;
  const cagr5Year = calculatePeriodCagr(growthYears);
  const cagr3Year = calculatePeriodCagr(growthYears, 3);

  const baseUnitCost = supplyUnitCost(sourceItem);
  const adjustmentRate = numberValue(analysis.manufacturerSellingPriceAdjustmentRate);
  const manufacturerAdjustedUnitCost = baseUnitCost === null
    ? null
    : baseUnitCost * (1 + ((adjustmentRate ?? 0) / 100));
  const calculatedAdjustedUnitCost = manufacturerAdjustedUnitCost;
  const adjustedUnitCostOverride = numberValue(analysis.adjustedUnitCostOverride);
  const adjustedUnitCost = adjustedUnitCostOverride !== null && adjustedUnitCostOverride > 0
    ? adjustedUnitCostOverride
    : baseUnitCost;
  const effectiveAdjustmentRate = baseUnitCost && adjustedUnitCost !== null
    ? ((adjustedUnitCost / baseUnitCost) - 1) * 100
    : null;
  const marketUnitCount = latestYear && adjustedUnitCost && adjustedUnitCost > 0
    ? latestYear.totalKrw / adjustedUnitCost
    : null;

  const nationwidePharmacyCount = numberValue(analysis.nationwidePharmacyCount);
  const chamyaksaPharmacyCount = numberValue(analysis.chamyaksaPharmacyCount);
  const pharmacyShareRate = nationwidePharmacyCount && chamyaksaPharmacyCount !== null
    ? (chamyaksaPharmacyCount / nationwidePharmacyCount) * 100
    : null;
  const penetrationRate = numberValue(analysis.franchisePenetrationRate);
  const annualDemandUnits = marketUnitCount !== null && pharmacyShareRate !== null && penetrationRate !== null
    ? marketUnitCount * (pharmacyShareRate / 100) * (penetrationRate / 100)
    : null;
  const activeChainPharmacies = chamyaksaPharmacyCount !== null && penetrationRate !== null
    ? chamyaksaPharmacyCount * (penetrationRate / 100)
    : null;
  const penetratedChamyaksaPharmacyShareRate = nationwidePharmacyCount && activeChainPharmacies !== null
    ? (activeChainPharmacies / nationwidePharmacyCount) * 100
    : null;
  const annualUnitsPerActivePharmacy = annualDemandUnits !== null && activeChainPharmacies
    ? annualDemandUnits / activeChainPharmacies
    : null;

  const batchQuantity = numberValue(sourceItem.quantity);
  const minimumOrderBatches = Math.max(1, Math.ceil(numberValue(sourceItem.minimumOrderBatchQuantity) ?? 1));
  const annualInterestRate = numberValue(analysis.annualInterestRate);
  const batchFinance = calculateBatchFinance({
    demandUnits: annualDemandUnits,
    batchQuantity,
    minimumOrderBatches,
    unitCost: manufacturerAdjustedUnitCost,
    annualInterestRate
  });

  const pricingScenarios = Array.isArray(sourceItem.distributionStructure?.pricingScenarios)
    ? sourceItem.distributionStructure.pricingScenarios
    : [];
  const pricingScenario = pricingScenarios.find((scenario) => (
    String(scenario.id) === String(analysis.pricingScenarioId)
  )) || pricingScenarios[0] || null;
  const marginRate = numberValue(pricingScenario?.chamyaksaMarginRate);
  const distributionSellingPrice = calculateSellingPriceFromMarginRate(baseUnitCost, marginRate);
  const chamyaksaSellingPriceAdjustmentRate = numberValue(analysis.chamyaksaSellingPriceAdjustmentRate);
  const chamyaksaSellingPrice = distributionSellingPrice !== null
    ? distributionSellingPrice
      * (1 + ((chamyaksaSellingPriceAdjustmentRate ?? 0) / 100))
    : null;
  const marginPerUnit = chamyaksaSellingPrice !== null && manufacturerAdjustedUnitCost !== null
    ? chamyaksaSellingPrice - manufacturerAdjustedUnitCost
    : null;
  const chamyaksaExpectedMarginRate = marginPerUnit !== null && chamyaksaSellingPrice > 0
    ? (marginPerUnit / chamyaksaSellingPrice) * 100
    : null;
  const expectedRevenue = annualDemandUnits !== null && chamyaksaSellingPrice !== null
    ? annualDemandUnits * chamyaksaSellingPrice
    : null;
  const expectedGrossProfit = annualDemandUnits !== null && marginPerUnit !== null
    ? annualDemandUnits * marginPerUnit
    : null;
  const expectedProfitAfterFinance = expectedGrossProfit !== null && batchFinance.annualFinanceCost !== null
    ? expectedGrossProfit - batchFinance.annualFinanceCost
    : null;
  const totalExpectedGrossProfit = batchFinance.orderQuantity !== null && marginPerUnit !== null
    ? batchFinance.orderQuantity * marginPerUnit
    : null;
  const totalExpectedProfitAfterFinance = totalExpectedGrossProfit !== null && batchFinance.totalFinanceCost !== null
    ? totalExpectedGrossProfit - batchFinance.totalFinanceCost
    : null;

  return {
    analysis,
    yearResults,
    latestYear,
    averageMarketKrw,
    growthYears,
    growthYearCount: growthYears.length,
    cagr: cagr5Year,
    cagr5Year,
    cagr3Year,
    baseUnitCost,
    manufacturerAdjustedUnitCost,
    calculatedAdjustedUnitCost,
    adjustedUnitCostOverride,
    adjustedUnitCost,
    effectiveAdjustmentRate,
    marketUnitCount,
    nationwidePharmacyCount,
    chamyaksaPharmacyCount,
    pharmacyShareRate,
    penetrationRate,
    annualDemandUnits,
    activeChainPharmacies,
    penetratedChamyaksaPharmacyShareRate,
    annualUnitsPerActivePharmacy,
    batchQuantity,
    minimumOrderBatches,
    minimumOrderQuantity: batchFinance.minimumOrderQuantity,
    exactBatches: batchFinance.exactBatches,
    requiredBatches: batchFinance.requiredBatches,
    orderBatchCount: batchFinance.orderBatchCount,
    orderQuantity: batchFinance.orderQuantity,
    depletionMonthsPerBatch: batchFinance.depletionMonthsPerBatch,
    annualDepletionRatePercent: batchFinance.annualDepletionRatePercent,
    annualFinanceMonths: batchFinance.annualFinanceMonths,
    batchCapital: batchFinance.batchCapital,
    averageInventoryCapital: batchFinance.averageInventoryCapital,
    annualInterestRate,
    annualFinanceCost: batchFinance.annualFinanceCost,
    totalFinanceCost: batchFinance.totalFinanceCost,
    pricingScenario,
    distributionSellingPrice,
    chamyaksaSellingPrice,
    marginPerUnit,
    chamyaksaExpectedMarginRate,
    expectedRevenue,
    expectedGrossProfit,
    expectedProfitAfterFinance,
    totalExpectedGrossProfit,
    totalExpectedProfitAfterFinance
  };
}
