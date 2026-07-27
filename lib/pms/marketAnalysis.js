function numberValue(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, ""));
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

function normalizeMarketYear(value = {}, fallback = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    id: source.id ?? fallback.id ?? `market_year_${Date.now()}`,
    year: String(source.year ?? fallback.year ?? ""),
    productionThousandKrw: String(source.productionThousandKrw ?? source.productionAmount ?? ""),
    importUsd: String(source.importUsd ?? source.importAmount ?? "")
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
    supplyPriceAdjustmentRate: String(source.supplyPriceAdjustmentRate ?? "0"),
    annualInterestRate: String(source.annualInterestRate ?? "4"),
    pricingScenarioId: String(source.pricingScenarioId ?? ""),
    marketYears,
    updatedAt: String(source.updatedAt || "")
  };
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

export function calculateMarketAnalysis(item = {}, rawAnalysis = {}) {
  const analysis = normalizeMarketSizeAnalysis(rawAnalysis);
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
  const latestYear = populatedYears.at(-1) || null;
  const earliestYear = populatedYears[0] || null;
  const averageMarketKrw = populatedYears.length
    ? populatedYears.reduce((sum, entry) => sum + entry.totalKrw, 0) / populatedYears.length
    : null;
  const yearGap = latestYear && earliestYear ? latestYear.year - earliestYear.year : 0;
  const cagr = yearGap > 0 && earliestYear.totalKrw > 0
    ? ((latestYear.totalKrw / earliestYear.totalKrw) ** (1 / yearGap) - 1) * 100
    : null;

  const baseUnitCost = supplyUnitCost(item);
  const adjustmentRate = numberValue(analysis.supplyPriceAdjustmentRate);
  const adjustedUnitCost = baseUnitCost === null
    ? null
    : baseUnitCost * (1 + ((adjustmentRate ?? 0) / 100));
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

  const batchQuantity = numberValue(item.quantity);
  const exactBatches = annualDemandUnits !== null && batchQuantity && batchQuantity > 0
    ? annualDemandUnits / batchQuantity
    : null;
  const requiredBatches = exactBatches === null ? null : Math.ceil(exactBatches);
  const depletionMonthsPerBatch = annualDemandUnits && batchQuantity
    ? (batchQuantity / annualDemandUnits) * 12
    : null;
  const batchCapital = adjustedUnitCost !== null && batchQuantity !== null
    ? adjustedUnitCost * batchQuantity
    : null;
  const averageInventoryUnits = annualDemandUnits !== null && batchQuantity !== null
    ? (annualDemandUnits >= batchQuantity
        ? batchQuantity / 2
        : Math.max(0, batchQuantity - (annualDemandUnits / 2)))
    : null;
  const averageInventoryCapital = averageInventoryUnits !== null && adjustedUnitCost !== null
    ? averageInventoryUnits * adjustedUnitCost
    : null;
  const annualInterestRate = numberValue(analysis.annualInterestRate);
  const annualFinanceCost = averageInventoryCapital !== null && annualInterestRate !== null
    ? averageInventoryCapital * (annualInterestRate / 100)
    : null;

  const pricingScenarios = Array.isArray(item.distributionStructure?.pricingScenarios)
    ? item.distributionStructure.pricingScenarios
    : [];
  const pricingScenario = pricingScenarios.find((scenario) => (
    String(scenario.id) === String(analysis.pricingScenarioId)
  )) || pricingScenarios[0] || null;
  const marginRate = numberValue(pricingScenario?.chamyaksaMarginRate);
  const chamyaksaSellingPrice = adjustedUnitCost !== null && marginRate !== null
    ? adjustedUnitCost * (1 + (marginRate / 100))
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
    cagr,
    baseUnitCost,
    adjustedUnitCost,
    marketUnitCount,
    nationwidePharmacyCount,
    chamyaksaPharmacyCount,
    pharmacyShareRate,
    penetrationRate,
    annualDemandUnits,
    activeChainPharmacies,
    annualUnitsPerActivePharmacy,
    batchQuantity,
    exactBatches,
    requiredBatches,
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
