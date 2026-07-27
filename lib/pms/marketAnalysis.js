function numberValue(value) {
  const normalized = String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!normalized || normalized === "-" || normalized === "." || normalized === "-.") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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
  const calculatedAdjustedUnitCost = baseUnitCost === null
    ? null
    : baseUnitCost * (1 + ((adjustmentRate ?? 0) / 100));
  const adjustedUnitCostOverride = numberValue(analysis.adjustedUnitCostOverride);
  const adjustedUnitCost = adjustedUnitCostOverride !== null && adjustedUnitCostOverride > 0
    ? adjustedUnitCostOverride
    : calculatedAdjustedUnitCost;
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
  const annualUnitsPerActivePharmacy = annualDemandUnits !== null && activeChainPharmacies
    ? annualDemandUnits / activeChainPharmacies
    : null;

  const batchQuantity = numberValue(sourceItem.quantity);
  const minimumOrderBatches = Math.max(1, Math.ceil(numberValue(sourceItem.minimumOrderBatchQuantity) ?? 1));
  const exactBatches = annualDemandUnits !== null && batchQuantity && batchQuantity > 0
    ? annualDemandUnits / batchQuantity
    : null;
  const requiredBatches = exactBatches === null ? null : Math.ceil(exactBatches);
  const orderBatchCount = requiredBatches === null ? null : Math.max(requiredBatches, minimumOrderBatches);
  const orderQuantity = orderBatchCount !== null && batchQuantity !== null
    ? orderBatchCount * batchQuantity
    : null;
  const depletionMonthsPerBatch = annualDemandUnits && orderQuantity
    ? (orderQuantity / annualDemandUnits) * 12
    : null;
  const batchCapital = adjustedUnitCost !== null && orderQuantity !== null
    ? adjustedUnitCost * orderQuantity
    : null;
  const averageInventoryUnits = annualDemandUnits !== null && orderQuantity !== null
    ? (annualDemandUnits >= orderQuantity
        ? orderQuantity / 2
        : Math.max(0, orderQuantity - (annualDemandUnits / 2)))
    : null;
  const averageInventoryCapital = averageInventoryUnits !== null && adjustedUnitCost !== null
    ? averageInventoryUnits * adjustedUnitCost
    : null;
  const annualInterestRate = numberValue(analysis.annualInterestRate);
  const annualFinanceCost = averageInventoryCapital !== null && annualInterestRate !== null
    ? averageInventoryCapital * (annualInterestRate / 100)
    : null;

  const pricingScenarios = Array.isArray(sourceItem.distributionStructure?.pricingScenarios)
    ? sourceItem.distributionStructure.pricingScenarios
    : [];
  const pricingScenario = pricingScenarios.find((scenario) => (
    String(scenario.id) === String(analysis.pricingScenarioId)
  )) || pricingScenarios[0] || null;
  const marginRate = numberValue(pricingScenario?.chamyaksaMarginRate);
  const chamyaksaSellingPriceAdjustmentRate = numberValue(analysis.chamyaksaSellingPriceAdjustmentRate);
  const chamyaksaSellingPrice = adjustedUnitCost !== null && marginRate !== null
    ? adjustedUnitCost
      * (1 + (marginRate / 100))
      * (1 + ((chamyaksaSellingPriceAdjustmentRate ?? 0) / 100))
    : null;
  const marginPerUnit = chamyaksaSellingPrice !== null && adjustedUnitCost !== null
    ? chamyaksaSellingPrice - adjustedUnitCost
    : null;
  const expectedRevenue = annualDemandUnits !== null && chamyaksaSellingPrice !== null
    ? annualDemandUnits * chamyaksaSellingPrice
    : null;
  const expectedGrossProfit = annualDemandUnits !== null && marginPerUnit !== null
    ? annualDemandUnits * marginPerUnit
    : null;
  const expectedProfitAfterFinance = expectedGrossProfit !== null && annualFinanceCost !== null
    ? expectedGrossProfit - annualFinanceCost
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
    annualUnitsPerActivePharmacy,
    batchQuantity,
    minimumOrderBatches,
    exactBatches,
    requiredBatches,
    orderBatchCount,
    orderQuantity,
    depletionMonthsPerBatch,
    batchCapital,
    averageInventoryCapital,
    annualInterestRate,
    annualFinanceCost,
    pricingScenario,
    chamyaksaSellingPrice,
    marginPerUnit,
    expectedRevenue,
    expectedGrossProfit,
    expectedProfitAfterFinance
  };
}
