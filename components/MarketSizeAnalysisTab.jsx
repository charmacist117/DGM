"use client";

import { useEffect, useMemo, useState } from "react";
import SegmentedDateInput from "@/components/SegmentedDateInput";
import {
  applyMarketAnalysisDefaults,
  calculateBatchFinance,
  calculateMarketAnalysis,
  marketAnalysisMatchesDefaults,
  normalizeMarketAnalysisDefaults,
  normalizeMarketSizeAnalysis
} from "@/lib/pms/marketAnalysis";
import {
  MARKET_DECISION_OPTIONS,
  marketDecisionBadgeStyle,
  marketDecisionLabel,
  normalizeMarketDecisionStatus
} from "@/lib/pms/marketDecision";

const panelStyle = {
  background: "#fff",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  overflow: "hidden"
};

const inputStyle = {
  width: "100%",
  minHeight: 36,
  padding: "7px 9px",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  background: "#fff",
  color: "#0f172a",
  fontSize: 14,
  boxSizing: "border-box"
};

const labelStyle = {
  display: "block",
  marginBottom: 5,
  color: "#475569",
  fontSize: 12,
  fontWeight: 800
};

const primaryButtonStyle = {
  minHeight: 34,
  padding: "7px 12px",
  border: "1px solid #0f172a",
  borderRadius: 6,
  background: "#0f172a",
  color: "#fff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 900
};

const secondaryButtonStyle = {
  minHeight: 34,
  padding: "7px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  background: "#fff",
  color: "#334155",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 800
};

function getItemLabel(item) {
  const ingredients = (item?.ingredients || [])
    .map((ingredient) => [ingredient?.name, ingredient?.content].filter(Boolean).join(" / "))
    .filter(Boolean);
  return ingredients.join(", ") || "성분 미입력";
}

function isDistributionConfigured(item) {
  const distribution = item?.distributionStructure;
  if (!distribution || typeof distribution !== "object" || Array.isArray(distribution)) return false;
  return typeof distribution.isConfigured === "boolean"
    ? distribution.isConfigured
    : Boolean(String(distribution.updatedAt || "").trim());
}

function formatWon(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatCompactWon(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}조원`;
  if (absolute >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}억원`;
  if (absolute >= 10_000) return `${(value / 10_000).toFixed(1)}만원`;
  return formatWon(value);
}

function formatCount(value, suffix = "개") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${Math.round(value).toLocaleString("ko-KR")}${suffix}`;
}

function formatDecimal(value, digits = 2, suffix = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: digits })}${suffix}`;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value, fallback) {
  const parsed = new Date(`${String(value || "")}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function addYears(date, years) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function addDaysToDate(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatPeriodDate(date) {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function decimalYear(date) {
  const year = date.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  return year + ((date.getTime() - start.getTime()) / (end.getTime() - start.getTime()));
}

function validateAnalysis(analysis) {
  const numericFields = [
    ["달러 환율", analysis.exchangeRate],
    ["전국 약국 수", analysis.nationwidePharmacyCount],
    ["참약사 약국 수", analysis.chamyaksaPharmacyCount],
    ["가맹약국 침투율", analysis.franchisePenetrationRate],
    ["참약사 판매가 조정률", analysis.chamyaksaSellingPriceAdjustmentRate],
    ["제조사 판매가 조정률", analysis.manufacturerSellingPriceAdjustmentRate],
    ["시장 환산 평균 공급단가", analysis.adjustedUnitCostOverride],
    ["연 이자율", analysis.annualInterestRate]
  ];
  for (const [label, value] of numericFields) {
    if (String(value || "").trim() && !Number.isFinite(Number(String(value).replace(/,/g, "")))) {
      throw new Error(`${label}은 숫자로 입력해주세요.`);
    }
  }
  const penetration = Number(analysis.franchisePenetrationRate);
  if (String(analysis.franchisePenetrationRate).trim() && (penetration < 0 || penetration > 100)) {
    throw new Error("가맹약국 침투율은 0~100 사이로 입력해주세요.");
  }
  for (const [label, value] of [
    ["참약사 판매가 조정률", analysis.chamyaksaSellingPriceAdjustmentRate],
    ["제조사 판매가 조정률", analysis.manufacturerSellingPriceAdjustmentRate]
  ]) {
    if (String(value).trim() && Number(value) <= -100) {
      throw new Error(`${label}은 -100%보다 커야 합니다.`);
    }
  }
  const adjustedUnitCostOverride = Number(String(analysis.adjustedUnitCostOverride).replace(/,/g, ""));
  if (String(analysis.adjustedUnitCostOverride).trim() && adjustedUnitCostOverride <= 0) {
    throw new Error("시장 환산 평균 공급단가는 0원보다 커야 합니다.");
  }
  const nationwide = Number(String(analysis.nationwidePharmacyCount).replace(/,/g, ""));
  const chamyaksa = Number(String(analysis.chamyaksaPharmacyCount).replace(/,/g, ""));
  if (nationwide > 0 && chamyaksa > nationwide) {
    throw new Error("참약사 약국 수는 전국 약국 수보다 클 수 없습니다.");
  }
  const enteredYears = analysis.marketYears
    .map((entry) => String(entry.year || "").trim())
    .filter(Boolean);
  if (new Set(enteredYears).size !== enteredYears.length) throw new Error("시장 실적 연도는 중복될 수 없습니다.");
  for (const entry of analysis.marketYears) {
    const year = Number(entry.year);
    if (String(entry.year || "").trim() && (!Number.isInteger(year) || year < 1900 || year > 2100)) {
      throw new Error("시장 실적 연도를 올바르게 입력해주세요.");
    }
    for (const [label, value] of [["생산실적", entry.productionThousandKrw], ["수입실적", entry.importUsd]]) {
      const parsed = Number(String(value || "").replace(/,/g, ""));
      if (String(value || "").trim() && (!Number.isFinite(parsed) || parsed < 0)) {
        throw new Error(`${entry.year || "해당 연도"} ${label}은 0 이상의 숫자로 입력해주세요.`);
      }
    }
  }
}

function FormulaHint({ formula }) {
  if (!formula) return null;
  return (
    <span
      className="formula-hint"
      title={`계산식: ${formula}`}
      aria-label={`계산식: ${formula}`}
      tabIndex={0}
    >
      i
    </span>
  );
}

function Metric({ label, value, subtext, tone = "default", className = "", formula = "" }) {
  const color = tone === "positive" ? "#047857" : (tone === "warning" ? "#b45309" : "#0f172a");
  return (
    <div className={`market-metric ${className}`.trim()}>
      <div className="metric-label-line">
        <span>{label}</span>
        <FormulaHint formula={formula} />
      </div>
      <strong style={{ color }}>{value}</strong>
      {subtext ? <small>{subtext}</small> : null}
    </div>
  );
}

export default function MarketSizeAnalysisTab({
  items = [],
  categories = [],
  selectedCategory = "all",
  selectedItemId,
  onSelectedItemChange,
  onUpdateItem,
  marketAnalysisDefaults = {},
  onMarketAnalysisDefaultsChange,
  onOpenSupply,
  onOpenDistribution,
  syncState
}) {
  const [search, setSearch] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("all");
  const [showConfiguredDistributionOnly, setShowConfiguredDistributionOnly] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [growthRatePeriod, setGrowthRatePeriod] = useState("all");
  const [yearOneMode, setYearOneMode] = useState("annual");
  const [annualForecastBaseDate, setAnnualForecastBaseDate] = useState(() => (
    toDateInputValue(new Date(new Date().getFullYear(), 0, 1))
  ));
  const [showDefaultsModal, setShowDefaultsModal] = useState(false);
  const [defaultsDraft, setDefaultsDraft] = useState(() => normalizeMarketAnalysisDefaults(marketAnalysisDefaults));
  const query = search.trim().toLowerCase();
  const categoryLabelById = Object.fromEntries(categories.map((category) => [category.id, category.label]));
  const visibleItems = useMemo(() => {
    const categoryItems = selectedCategory === "all"
      ? items
      : items.filter((item) => item.category === selectedCategory);
    const distributionItems = showConfiguredDistributionOnly
      ? categoryItems.filter(isDistributionConfigured)
      : categoryItems;
    const decisionItems = decisionFilter === "all"
      ? distributionItems
      : distributionItems.filter((item) => normalizeMarketDecisionStatus(item.marketDecisionStatus) === decisionFilter);
    if (!query) return decisionItems;
    return decisionItems.filter((item) => [
      item.manufacturer,
      item.packagingUnit,
      ...(item.ingredients || []).flatMap((ingredient) => [ingredient.name, ingredient.content])
    ].join(" ").toLowerCase().includes(query));
  }, [decisionFilter, items, query, selectedCategory, showConfiguredDistributionOnly]);

  const normalizedDefaults = useMemo(
    () => normalizeMarketAnalysisDefaults(marketAnalysisDefaults),
    [marketAnalysisDefaults]
  );
  const selectedItem = visibleItems.find((item) => String(item.id) === String(selectedItemId)) || visibleItems[0] || null;
  const storedAnalysis = normalizeMarketSizeAnalysis(selectedItem?.marketSizeAnalysis);
  const savedAnalysis = applyMarketAnalysisDefaults(storedAnalysis, normalizedDefaults);
  const isEditing = selectedItem && String(editingItemId) === String(selectedItem.id);
  const workingAnalysis = isEditing && draft ? draft : savedAnalysis;
  const calculations = calculateMarketAnalysis(selectedItem, workingAnalysis, normalizedDefaults);
  const growthRateYears = growthRatePeriod === "3y"
    ? Math.min(3, calculations.growthYearCount)
    : calculations.growthYearCount;
  const selectedGrowthRate = growthRatePeriod === "3y"
    ? calculations.cagr3Year
    : calculations.cagr5Year;
  const pricingScenarios = Array.isArray(selectedItem?.distributionStructure?.pricingScenarios)
    ? selectedItem.distributionStructure.pricingScenarios
    : [];
  const maxYearTotal = Math.max(1, ...calculations.yearResults.map((entry) => entry.totalKrw));
  const today = new Date();
  const currentYear = today.getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);
  const startOfNextYear = new Date(currentYear + 1, 0, 1);
  const elapsedYearRatio = Math.min(
    1,
    Math.max(0, (today.getTime() - startOfYear.getTime() + 86_400_000) / (startOfNextYear.getTime() - startOfYear.getTime()))
  );
  const growthMultiplier = Number.isFinite(selectedGrowthRate)
    ? Math.max(0, 1 + (selectedGrowthRate / 100))
    : 1;
  const annualDemandBase = calculations.annualDemandUnits;
  const annualPeriodStart = parseDateInput(annualForecastBaseDate, startOfYear);
  const latestMarketYear = calculations.latestYear?.year ?? currentYear - 1;
  const annualStartGrowthYears = Math.max(0, decimalYear(annualPeriodStart) - latestMarketYear);
  const currentFullYearGrowthYears = Math.max(0, currentYear - latestMarketYear);
  const demandForecasts = [0, 1, 2].map((offset) => {
    const growthYears = yearOneMode === "annual"
      ? annualStartGrowthYears + offset
      : currentFullYearGrowthYears + offset;
    const periodRatio = yearOneMode === "ytd" && offset === 0 ? elapsedYearRatio : 1;
    const periodStart = yearOneMode === "annual"
      ? addYears(annualPeriodStart, offset)
      : new Date(currentYear + offset, 0, 1);
    const periodEnd = yearOneMode === "annual"
      ? addDaysToDate(addYears(annualPeriodStart, offset + 1), -1)
      : new Date(currentYear + offset, 11, 31);
    return {
      year: periodStart.getFullYear(),
      growthYears,
      periodStart,
      periodEnd,
      value: annualDemandBase === null
        ? null
        : annualDemandBase * (growthMultiplier ** growthYears) * periodRatio
    };
  });
  const scenarioForecasts = demandForecasts.map((forecast) => {
    const finance = calculateBatchFinance({
      demandUnits: forecast.value,
      batchQuantity: calculations.batchQuantity,
      minimumOrderBatches: calculations.minimumOrderBatches,
      unitCost: calculations.manufacturerAdjustedUnitCost,
      annualInterestRate: calculations.annualInterestRate
    });
    const expectedRevenue = forecast.value !== null && calculations.chamyaksaSellingPrice !== null
      ? forecast.value * calculations.chamyaksaSellingPrice
      : null;
    const expectedGrossProfit = forecast.value !== null && calculations.marginPerUnit !== null
      ? forecast.value * calculations.marginPerUnit
      : null;
    const expectedProfitAfterFinance = expectedGrossProfit !== null && finance.annualFinanceCost !== null
      ? expectedGrossProfit - finance.annualFinanceCost
      : null;
    return {
      ...forecast,
      finance,
      expectedRevenue,
      expectedGrossProfit,
      expectedProfitAfterFinance
    };
  });
  const planningBatchFinance = scenarioForecasts[0]?.finance ?? calculateBatchFinance();
  const planningTotalExpectedGrossProfit = planningBatchFinance.orderQuantity !== null
    && calculations.marginPerUnit !== null
    ? planningBatchFinance.orderQuantity * calculations.marginPerUnit
    : null;
  const planningTotalExpectedProfitAfterFinance = planningTotalExpectedGrossProfit !== null
    && planningBatchFinance.totalFinanceCost !== null
    ? planningTotalExpectedGrossProfit - planningBatchFinance.totalFinanceCost
    : null;
  const manufacturerAdjustmentRate = Number(calculations.analysis.manufacturerSellingPriceAdjustmentRate);
  const manufacturerCostSubtext = Number.isFinite(manufacturerAdjustmentRate) && manufacturerAdjustmentRate !== 0
    ? `기존 ${formatWon(calculations.baseUnitCost)} · 제조사 ${manufacturerAdjustmentRate > 0 ? "+" : ""}${formatDecimal(manufacturerAdjustmentRate, 2, "%")}`
    : "공급단가 기준";
  const planningBasisLabel = selectedGrowthRate === null
    ? (yearOneMode === "ytd"
        ? "Year 1 YTD 기준"
        : `Year 1 연간 ${formatPeriodDate(annualPeriodStart)} 시작`)
    : (yearOneMode === "ytd"
        ? `${growthRateYears}개년 성장률 · Year 1 YTD 기준`
        : `${growthRateYears}개년 성장률 · 연간 ${formatPeriodDate(annualPeriodStart)} 시작`);

  useEffect(() => {
    setEditingItemId(null);
    setDraft(null);
  }, [selectedItem?.id]);

  const beginEdit = () => {
    if (!selectedItem) return;
    setEditingItemId(selectedItem.id);
    setDraft(applyMarketAnalysisDefaults(selectedItem.marketSizeAnalysis, normalizedDefaults));
  };

  const updateDraft = (patch) => {
    setDraft((previous) => ({
      ...normalizeMarketSizeAnalysis(previous),
      ...patch,
      conditionMode: patch.conditionMode ?? "custom"
    }));
  };

  const updateMarketYear = (yearId, patch) => {
    updateDraft({
      marketYears: workingAnalysis.marketYears.map((entry) => (
        String(entry.id) === String(yearId) ? { ...entry, ...patch } : entry
      ))
    });
  };

  const saveAnalysis = () => {
    if (!selectedItem || !draft) return;
    try {
      validateAnalysis(draft);
      const usesDefaults = marketAnalysisMatchesDefaults(draft, normalizedDefaults);
      if (!usesDefaults && !window.confirm("기본값과 다른 내용입니다. 저장하시겠습니까?")) return;
      onUpdateItem?.(selectedItem.id, {
        marketSizeAnalysis: {
          ...normalizeMarketSizeAnalysis(draft),
          conditionMode: usesDefaults ? "default" : "custom",
          updatedAt: new Date().toISOString()
        }
      });
      setEditingItemId(null);
      setDraft(null);
    } catch (error) {
      window.alert(String(error?.message || error));
    }
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setDraft(null);
  };

  const resetConditionsToDefaults = () => {
    if (!isEditing) return;
    updateDraft({
      ...normalizedDefaults,
      adjustedUnitCostOverride: "",
      pricingScenarioId: "",
      conditionMode: "default"
    });
  };

  const openDefaultsModal = () => {
    setDefaultsDraft(normalizeMarketAnalysisDefaults(normalizedDefaults));
    setShowDefaultsModal(true);
  };

  const saveDefaults = () => {
    try {
      const normalized = normalizeMarketAnalysisDefaults(defaultsDraft);
      validateAnalysis(normalizeMarketSizeAnalysis({ ...normalized, conditionMode: "custom" }));
      onMarketAnalysisDefaultsChange?.(normalized);
      setShowDefaultsModal(false);
    } catch (error) {
      window.alert(String(error?.message || error));
    }
  };

  const resetAnalysis = () => {
    if (!selectedItem || !savedAnalysis.updatedAt) return;
    if (!window.confirm("이 품목의 시장 규모 분석 입력값을 모두 초기화하고 미설정 상태로 되돌리시겠습니까?")) return;
    onUpdateItem?.(selectedItem.id, { marketSizeAnalysis: {} });
    setEditingItemId(null);
    setDraft(null);
  };

  const fieldStyle = isEditing
    ? inputStyle
    : { ...inputStyle, background: "#f8fafc", color: "#475569", cursor: "default" };

  return (
    <div className="market-root">
      <section style={{ ...panelStyle, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, color: "#0f172a", fontSize: 23 }}>시장 규모 분석</h1>
            <div className="market-banner-description">
              <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
                공급단가 건별 시장 실적, 약국 침투율, 배치 소진과 금융비용을 분석합니다.
              </p>
              <button type="button" onClick={openDefaultsModal} style={secondaryButtonStyle}>기본값 등록/수정</button>
            </div>
          </div>
          <div style={{ color: syncState?.status === "error" ? "#dc2626" : "#059669", fontSize: 12, fontWeight: 800, textAlign: "right" }}>
            {syncState?.message || "변경 내용 자동 저장"}
          </div>
        </div>
      </section>

      <div className="market-layout">
        <aside style={{ ...panelStyle, minWidth: 0, overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #dbe3ee", background: "#f8fafc" }}>
            <label className="market-distribution-filter">
              <input
                type="checkbox"
                checked={showConfiguredDistributionOnly}
                onChange={(event) => setShowConfiguredDistributionOnly(event.target.checked)}
              />
              <span>유통 구조 설정 건만 보기</span>
            </label>
            <label htmlFor="market-search" style={labelStyle}>공급단가 건 검색</label>
            <select value={decisionFilter} onChange={(event) => setDecisionFilter(event.target.value)} style={{ ...inputStyle, marginBottom: 8 }} aria-label="시장 검토결과 필터">
              <option value="all">검토결과 전체</option>
              {MARKET_DECISION_OPTIONS.map((option) => <option key={option.value || "undecided"} value={option.value}>{option.label}</option>)}
            </select>
            <input
              id="market-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="성분명 또는 제조사"
              style={inputStyle}
            />
          </div>
          <div style={{ maxHeight: "calc(100vh - 236px)", overflowY: "auto", padding: 8 }}>
            {visibleItems.map((item) => {
              const active = selectedItem && String(item.id) === String(selectedItem.id);
              const market = normalizeMarketSizeAnalysis(item.marketSizeAnalysis);
              const fullLabel = getItemLabel(item);
              return (
                <button
                  key={item.id}
                  className="market-item-button"
                  type="button"
                  onClick={() => onSelectedItemChange?.(item.id)}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    maxWidth: "100%",
                    overflow: "hidden",
                    marginBottom: 7,
                    padding: "11px 10px",
                    border: `1px solid ${active ? "#2563eb" : "#dbe3ee"}`,
                    borderRadius: 7,
                    background: active ? "#eff6ff" : "#fff",
                    color: "#0f172a",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  <div style={{ width: "100%", minWidth: 0, display: "flex", justifyContent: "space-between", gap: 8, overflow: "hidden" }}>
                    <strong title={fullLabel} aria-label={fullLabel} style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14 }}>
                      {fullLabel}
                    </strong>
                    <span style={{ flex: "0 0 auto", color: "#64748b", fontSize: 11 }}>
                      {categoryLabelById[item.category] || item.category}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>
                    {item.manufacturer || "제조사 미입력"} · {item.quoteDate || "견적일 미입력"}
                  </div>
                  <div style={{ marginTop: 3, color: "#475569", fontSize: 11, fontWeight: 700 }}>
                    포장단위: {item.packagingUnit || "미입력"}
                    {item.packagingForm ? ` · ${item.packagingForm}` : ""}
                    {" · "}최소 주문: {item.minimumOrderBatchQuantity
                      ? `${item.minimumOrderBatchQuantity}배치`
                      : "미입력(계산 기본 1배치)"}
                  </div>
                  <div style={{ marginTop: 5, color: market.updatedAt ? "#047857" : "#94a3b8", fontSize: 11, fontWeight: 800 }}>
                    {market.updatedAt ? "시장 분석 설정됨" : "시장 분석 미설정"}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span style={{ ...marketDecisionBadgeStyle(item.marketDecisionStatus), minHeight: 21, padding: "2px 7px", fontSize: 11 }}>
                      검토결과 · {marketDecisionLabel(item.marketDecisionStatus)}
                    </span>
                  </div>
                </button>
              );
            })}
            {visibleItems.length === 0 && (
              <div style={{ padding: 18, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
                {showConfiguredDistributionOnly
                  ? "유통 구조가 설정된 공급단가 건이 없습니다."
                  : "표시할 공급단가 건이 없습니다."}
              </div>
            )}
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          {!selectedItem ? (
            <section style={{ ...panelStyle, padding: 28, color: "#64748b", textAlign: "center" }}>
              공급단가 건을 먼저 등록하거나 왼쪽 목록에서 선택해주세요.
            </section>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <section style={panelStyle}>
                <div className="market-item-header">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "#0f172a", fontSize: 18, fontWeight: 900 }}>{getItemLabel(selectedItem)}</div>
                    <div style={{ marginTop: 3, color: "#64748b", fontSize: 12 }}>
                      {selectedItem.manufacturer || "제조사 미입력"} · {categoryLabelById[selectedItem.category] || selectedItem.category}
                      {" · "}포장단위 {selectedItem.packagingUnit || "미입력"}
                      {" · "}최소 주문 {selectedItem.minimumOrderBatchQuantity
                        ? `${selectedItem.minimumOrderBatchQuantity}배치`
                        : "미입력(계산 기본 1배치)"}
                    </div>
                  </div>
                  <div className="market-actions">
                    <label className="market-decision-control">
                      <span>검토결과</span>
                      <select
                        value={normalizeMarketDecisionStatus(selectedItem.marketDecisionStatus)}
                        onChange={(event) => onUpdateItem?.(selectedItem.id, {
                          marketDecisionStatus: normalizeMarketDecisionStatus(event.target.value)
                        })}
                        style={{
                          ...inputStyle,
                          width: 122,
                          minHeight: 34,
                          padding: "6px 8px",
                          color: marketDecisionBadgeStyle(selectedItem.marketDecisionStatus).color,
                          fontWeight: 900
                        }}
                      >
                        {MARKET_DECISION_OPTIONS.map((option) => (
                          <option key={option.value || "undecided"} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <button type="button" onClick={() => onOpenSupply?.(selectedItem.id)} style={secondaryButtonStyle}>공급단가 보기</button>
                    <button type="button" onClick={() => onOpenDistribution?.(selectedItem.id)} style={secondaryButtonStyle}>유통 구조 설정</button>
                    {!isEditing ? (
                      <button type="button" onClick={beginEdit} style={primaryButtonStyle}>
                        {savedAnalysis.updatedAt ? "수정" : "입력 시작"}
                      </button>
                    ) : (
                      <>
                        <button type="button" onClick={saveAnalysis} style={primaryButtonStyle}>저장</button>
                        <button type="button" onClick={cancelEdit} style={secondaryButtonStyle}>취소</button>
                      </>
                    )}
                  </div>
                </div>
              </section>

              <div className="market-input-grid">
                <section style={panelStyle}>
                  <div className="section-title">
                    <div>
                      <strong>최근 5개년 시장 실적</strong>
                      <span>생산실적 × 1,000원 + 수입실적 × 기준 환율 · 출처: 식품의약품안전처 의약품안전나라 공개 데이터</span>
                    </div>
                    <label>
                      기준 달러환율
                      <input
                        value={workingAnalysis.exchangeRate}
                        onChange={(event) => updateDraft({ exchangeRate: event.target.value })}
                        disabled={!isEditing}
                        inputMode="decimal"
                        style={{ ...fieldStyle, width: 120 }}
                      />
                    </label>
                  </div>
                  <div className="market-year-table">
                    <div className="market-year-head">연도</div>
                    <div className="market-year-head">생산실적 (천원)</div>
                    <div className="market-year-head">수입실적 (USD)</div>
                    <div className="market-year-head">합산 시장규모</div>
                    <div className="market-year-head growth-include-head">성장률 포함</div>
                    {calculations.yearResults.map((entry) => (
                      <div key={entry.id} style={{ display: "contents" }}>
                        <input
                          value={entry.year ?? ""}
                          onChange={(event) => updateMarketYear(entry.id, { year: event.target.value })}
                          disabled={!isEditing}
                          inputMode="numeric"
                          style={fieldStyle}
                        />
                        <input
                          value={workingAnalysis.marketYears.find((year) => String(year.id) === String(entry.id))?.productionThousandKrw || ""}
                          onChange={(event) => updateMarketYear(entry.id, { productionThousandKrw: event.target.value })}
                          disabled={!isEditing}
                          inputMode="decimal"
                          placeholder="천원 단위"
                          style={fieldStyle}
                        />
                        <input
                          value={workingAnalysis.marketYears.find((year) => String(year.id) === String(entry.id))?.importUsd || ""}
                          onChange={(event) => updateMarketYear(entry.id, { importUsd: event.target.value })}
                          disabled={!isEditing}
                          inputMode="decimal"
                          placeholder="달러 단위"
                          style={fieldStyle}
                        />
                        <div className="year-total-cell">
                          <span>{formatCompactWon(entry.totalKrw || null)}</span>
                          <i style={{ width: `${Math.max(0, Math.min(100, (entry.totalKrw / maxYearTotal) * 100))}%` }} />
                        </div>
                        <label className="growth-include-cell">
                          <input
                            type="checkbox"
                            checked={entry.includeInGrowthRate}
                            onChange={(event) => updateMarketYear(entry.id, { includeInGrowthRate: event.target.checked })}
                            disabled={!isEditing}
                          />
                          <span>{entry.includeInGrowthRate ? "포함" : "제외"}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </section>

                <section style={panelStyle}>
                  <div className="section-title">
                    <div>
                      <strong>분석 조건</strong>
                      <span>약국 점유율, 침투율과 원가 조정 시나리오</span>
                    </div>
                    {isEditing && (
                      <button type="button" onClick={resetConditionsToDefaults} style={secondaryButtonStyle}>
                        기본값으로 초기화
                      </button>
                    )}
                  </div>
                  <div className="condition-grid">
                    <label>
                      <span>전국 약국 수</span>
                      <input value={workingAnalysis.nationwidePharmacyCount} onChange={(event) => updateDraft({ nationwidePharmacyCount: event.target.value })} disabled={!isEditing} inputMode="numeric" style={fieldStyle} />
                    </label>
                    <label>
                      <span>참약사 약국 수</span>
                      <input value={workingAnalysis.chamyaksaPharmacyCount} onChange={(event) => updateDraft({ chamyaksaPharmacyCount: event.target.value })} disabled={!isEditing} inputMode="numeric" style={fieldStyle} />
                    </label>
                    <label>
                      <span>가맹약국 예상 침투율 (%)</span>
                      <input value={workingAnalysis.franchisePenetrationRate} onChange={(event) => updateDraft({ franchisePenetrationRate: event.target.value })} disabled={!isEditing} inputMode="decimal" placeholder="예: 30" style={fieldStyle} />
                    </label>
                    <label>
                      <span>참약사 판매가 조정률 (%)</span>
                      <input value={workingAnalysis.chamyaksaSellingPriceAdjustmentRate} onChange={(event) => updateDraft({ chamyaksaSellingPriceAdjustmentRate: event.target.value })} disabled={!isEditing} inputMode="decimal" placeholder="인하 시 음수" style={fieldStyle} />
                    </label>
                    <label>
                      <span>제조사 판매가 조정률 (%)</span>
                      <input value={workingAnalysis.manufacturerSellingPriceAdjustmentRate} onChange={(event) => updateDraft({ manufacturerSellingPriceAdjustmentRate: event.target.value })} disabled={!isEditing} inputMode="decimal" placeholder="인하 시 음수" style={fieldStyle} />
                    </label>
                    <label>
                      <span>시장 환산 평균 공급단가 (원)</span>
                      <input
                        value={workingAnalysis.adjustedUnitCostOverride}
                        onChange={(event) => updateDraft({ adjustedUnitCostOverride: event.target.value })}
                        disabled={!isEditing}
                        inputMode="decimal"
                        placeholder="비우면 기존 공급원가 사용"
                        style={fieldStyle}
                      />
                    </label>
                    <label>
                      <span>연 금융비용 이자율 (%)</span>
                      <input value={workingAnalysis.annualInterestRate} onChange={(event) => updateDraft({ annualInterestRate: event.target.value })} disabled={!isEditing} inputMode="decimal" style={fieldStyle} />
                    </label>
                    <label>
                      <span>유통 가격대 기준</span>
                      <select
                        value={workingAnalysis.pricingScenarioId}
                        onChange={(event) => updateDraft({ pricingScenarioId: event.target.value })}
                        disabled={!isEditing}
                        style={fieldStyle}
                      >
                        <option value="">기본 가격대</option>
                        {pricingScenarios.map((scenario, index) => (
                          <option key={scenario.id} value={scenario.id}>{scenario.label || `가격대 ${index + 1}`}</option>
                        ))}
                      </select>
                    </label>
                  </div>
      </section>
              </div>

              <section style={panelStyle}>
                <div className="section-title">
                  <div>
                    <strong>시장 환산 및 약국 침투</strong>
                    <span>{calculations.latestYear ? `${calculations.latestYear.year}년 실적 기준` : "최근 연도 실적을 입력해주세요."}</span>
                  </div>
                  <div className="growth-period-control" role="group" aria-label="연평균 성장률 기간">
                    {[
                      ["all", "최대 5개년"],
                      ["3y", "최근 3개년"]
                    ].map(([period, label]) => {
                      const active = growthRatePeriod === period;
                      return (
                        <button
                          key={period}
                          type="button"
                          onClick={() => setGrowthRatePeriod(period)}
                          aria-pressed={active}
                          style={{
                            minHeight: 30,
                            padding: "5px 10px",
                            border: active ? "1px solid #2563eb" : "1px solid #cbd5e1",
                            borderRadius: 5,
                            background: active ? "#eff6ff" : "#fff",
                            color: active ? "#1d4ed8" : "#475569",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 900
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="metric-grid">
                  <Metric
                    label="기준 시장 규모"
                    value={formatCompactWon(calculations.latestYear?.totalKrw)}
                    formula="최신 연도 생산실적(천원) × 1,000 + 최신 연도 수입실적(USD) × 기준 환율"
                  />
                  <Metric
                    label="5개년 평균 시장 규모"
                    value={formatCompactWon(calculations.averageMarketKrw)}
                    formula="값이 입력된 각 연도 합산 시장 규모의 합 ÷ 입력 연도 수"
                  />
                  <Metric
                    label={growthRateYears > 0 ? `${growthRateYears}개년 연평균 성장률` : "연평균 성장률"}
                    value={formatDecimal(selectedGrowthRate, 2, "%")}
                    subtext={selectedGrowthRate === null
                      ? "성장률 포함 실적을 2개년 이상 선택해주세요."
                      : (growthRatePeriod === "3y" ? "포함된 최근 3개 실적 기준" : `포함 선택한 ${growthRateYears}개 실적 기준`)}
                    tone={selectedGrowthRate === null ? "default" : (selectedGrowthRate >= 0 ? "positive" : "warning")}
                    formula="(마지막 포함 연도 시장 규모 ÷ 첫 포함 연도 시장 규모)^(1 ÷ 연도 간격) - 1"
                  />
                  <Metric
                    label="전국 예상 공급수량"
                    value={formatCount(calculations.marketUnitCount)}
                    subtext={`시장 환산 단가 ${formatWon(calculations.adjustedUnitCost)}`}
                    formula="기준 시장 규모 ÷ 시장 환산 평균 공급단가"
                  />
                  <Metric
                    label="참약사 약국 점유율"
                    value={formatDecimal(calculations.pharmacyShareRate, 2, "%")}
                    formula="참약사 약국 수 ÷ 전국 약국 수 × 100"
                  />
                  <Metric
                    label="침투 예상 가맹약국"
                    value={formatCount(calculations.activeChainPharmacies, "개소")}
                    formula="참약사 약국 수 × 가맹약국 예상 침투율"
                  />
                  <Metric
                    label="연간 예상 소진수량"
                    value={formatCount(calculations.annualDemandUnits)}
                    tone="positive"
                    formula="전국 예상 공급수량 × 참약사 약국 점유율 × 가맹약국 예상 침투율"
                  />
                  <Metric
                    label="침투 약국당 연간 수량"
                    value={formatCount(calculations.annualUnitsPerActivePharmacy)}
                    formula="연간 예상 소진수량 ÷ 침투 예상 가맹약국 수"
                  />
                </div>
                <div className="forecast-band">
                  <div className="forecast-heading">
                    <div>
                      <strong>성장률 반영 예상 소진수량</strong>
                      <span>
                        {selectedGrowthRate === null
                          ? "성장률이 없으면 현재 예상 소진수량을 유지합니다."
                          : `${growthRateYears}개년 연평균 성장률 ${formatDecimal(selectedGrowthRate, 2, "%")} 적용`}
                        {yearOneMode === "ytd"
                          ? " · 현재 시점까지 성장률을 일할 반영한 환산값에 Year 2·3의 연간 성장률을 순차 적용합니다."
                          : ""}
                      </span>
                    </div>
                    <div className="forecast-controls">
                      {yearOneMode === "annual" && (
                        <label className="annual-base-date-control">
                          <span>연간 기준 시작일</span>
                          <SegmentedDateInput
                            aria-label="연간 기준 시작일"
                            value={annualForecastBaseDate}
                            onChange={(value) => setAnnualForecastBaseDate(value || toDateInputValue(startOfYear))}
                            style={{ width: 170, minHeight: 30, padding: "4px 7px", fontSize: 12 }}
                          />
                        </label>
                      )}
                      <div className="growth-period-control" role="group" aria-label="예상 소진수량 계산 기준">
                        {[
                          ["annual", "연간 기준"],
                          ["ytd", "YTD 기준"]
                        ].map(([mode, label]) => {
                          const active = yearOneMode === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setYearOneMode(mode)}
                              aria-pressed={active}
                              className={active ? "segment-active" : ""}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="forecast-grid">
                    {demandForecasts.map((forecast, index) => (
                      <Metric
                        key={`${yearOneMode}_${toDateInputValue(forecast.periodStart)}`}
                        label={`Year ${index + 1}${index === 0 && yearOneMode === "ytd" ? " · YTD 환산" : ""}`}
                        value={formatCount(forecast.value)}
                        subtext={yearOneMode === "ytd"
                          ? (index === 0
                              ? `${forecast.year}년 현재 시점 · 연간 전망의 ${formatDecimal(elapsedYearRatio * 100, 1, "%")} 일할 반영`
                              : `${forecast.year}년 1/1~12/31 · 성장률 ${formatDecimal(forecast.growthYears, 2, "년")} 반영`)
                          : `${formatPeriodDate(forecast.periodStart)}~${formatPeriodDate(forecast.periodEnd)} · 성장률 ${formatDecimal(forecast.growthYears, 2, "년")} 반영`}
                        tone="positive"
                        formula={yearOneMode === "ytd" && index === 0
                          ? "연간 예상 소진수량 × (1 + 연평균 성장률)^최신 실적 이후 연수 × 현재 연도 경과일수 비율"
                          : "연간 예상 소진수량 × (1 + 연평균 성장률)^최신 실적 연도부터 해당 기간 시작일까지의 연수"}
                      />
                    ))}
                  </div>
                </div>
              </section>

              <div className="market-result-grid">
                <section style={panelStyle}>
                  <div className="section-title">
                    <div>
                      <strong>배치 소진 및 금융비용</strong>
                      <span>{planningBasisLabel} · 금융비용은 분석 조건에서 조정할 수 있습니다.</span>
                    </div>
                  </div>
                  <div className="metric-grid metric-grid-compact">
                    <Metric
                      label="공급단가 최소 주문 수량"
                      value={formatCount(planningBatchFinance.minimumOrderQuantity)}
                      subtext={`공급단가 입력값 · 배치 당 포장단위 개수 ${formatCount(calculations.batchQuantity)} × 최소 ${calculations.minimumOrderBatches}배치`}
                      formula="공급단가의 배치 당 포장단위 개수 × 공급단가의 최소 주문 배치 수"
                    />
                    <Metric
                      label="연간 필요 배치"
                      value={formatDecimal(planningBatchFinance.exactBatches, 2, "배치")}
                      subtext={planningBatchFinance.orderBatchCount === null
                        ? ""
                        : `연간 소진 충족 조달 예상 ${planningBatchFinance.orderBatchCount}배치`}
                      formula="해당 연도 예상 소진수량 ÷ 배치 당 포장단위 개수"
                    />
                    <Metric
                      label="연간 조달 예상수량"
                      value={formatCount(planningBatchFinance.orderQuantity)}
                      subtext={`필요 배치 올림과 최소 주문 조건 중 큰 값 · ${planningBatchFinance.orderBatchCount ?? "-"}배치`}
                      formula="max(올림(연간 필요 배치), 공급단가 최소 주문 배치 수) × 배치 당 포장단위 개수"
                    />
                    <Metric
                      label="주문 수량 소진 예상기간"
                      value={formatDecimal(planningBatchFinance.depletionMonthsPerBatch, 1, "개월")}
                      tone={planningBatchFinance.depletionMonthsPerBatch > 12 ? "warning" : "default"}
                      formula="연간 조달 예상수량 ÷ 해당 연도 예상 소진수량 × 12개월"
                    />
                    <Metric
                      label="연간 조달 필요자금"
                      value={formatCompactWon(planningBatchFinance.batchCapital)}
                      formula="연간 조달 예상수량 × 제조사 조정 공급원가"
                    />
                    <Metric
                      label="평균 재고자금"
                      value={formatCompactWon(planningBatchFinance.averageInventoryCapital)}
                      formula="FY 내 월별 균등 소진을 가정한 평균 재고수량 × 제조사 조정 공급원가"
                    />
                    <Metric
                      label="연간 금융 기회비용"
                      value={formatWon(planningBatchFinance.annualFinanceCost)}
                      subtext={`FY 기준 · 재고 보유 ${formatDecimal(planningBatchFinance.annualFinanceMonths, 1, "개월")} 반영`}
                      tone="warning"
                      formula="FY 평균 재고자금 × 연 금융비용 이자율"
                    />
                    <Metric
                      label="총 금융 기회비용"
                      value={formatWon(planningBatchFinance.totalFinanceCost)}
                      subtext={`연간 필요 ${formatDecimal(planningBatchFinance.exactBatches, 2, "배치")} · 주문물량 연 ${formatDecimal(planningBatchFinance.annualDepletionRatePercent, 1, "%")} 소진 · 총 ${formatDecimal(planningBatchFinance.depletionMonthsPerBatch, 1, "개월")}`}
                      tone="warning"
                      className="total-finance-metric"
                      formula="연간 조달 필요자금 × 연 금융비용 이자율 × (총 소진개월 ÷ 12) ÷ 2"
                    />
                  </div>
                </section>

                <section style={panelStyle}>
                  <div className="section-title">
                    <div>
                      <strong>조정 시나리오 기댓값</strong>
                      <span>{planningBasisLabel} · 침투율·실제 공급원가·유통 구조 판매가 기준</span>
                    </div>
                  </div>
                  <div className="metric-grid metric-grid-compact scenario-metric-grid">
                    <Metric
                      label="기준 공급 원가"
                      value={formatWon(calculations.manufacturerAdjustedUnitCost)}
                      subtext={manufacturerCostSubtext}
                      formula="기존 공급원가 × (1 + 제조사 판매가 조정률)"
                    />
                    <Metric
                      label="참약사 예상 판매가"
                      value={formatWon(calculations.chamyaksaSellingPrice)}
                      subtext={calculations.distributionSellingPrice === null
                        ? "유통 마진 미설정"
                        : `유통 구조 ${formatWon(calculations.distributionSellingPrice)} · ${calculations.pricingScenario?.label || "기본"}`}
                      formula="유통 구조 참약사 판매가 × (1 + 참약사 판매가 조정률)"
                    />
                    <Metric
                      label="참약사 예상 마진율"
                      value={formatDecimal(calculations.chamyaksaExpectedMarginRate, 2, "%")}
                      subtext="제조사 조정 공급원가 반영"
                      tone={calculations.chamyaksaExpectedMarginRate >= 0 ? "positive" : "warning"}
                      formula="(참약사 예상 판매가 - 제조사 조정 공급원가) ÷ 참약사 예상 판매가 × 100"
                    />
                    <Metric
                      label="개당 예상 매출총이익"
                      value={formatWon(calculations.marginPerUnit)}
                      tone="positive"
                      formula="참약사 예상 판매가 - 제조사 조정 공급원가"
                    />
                    {scenarioForecasts.map((forecast, index) => (
                      <div className="market-metric scenario-year-metric" key={`scenario_${yearOneMode}_${toDateInputValue(forecast.periodStart)}`}>
                        <span>Year {index + 1}{index === 0 && yearOneMode === "ytd" ? " · YTD" : ""}</span>
                        <strong>{index === 0 && yearOneMode === "ytd" ? "YTD 손익 전망" : "연간 손익 전망"}</strong>
                        <small>
                          {formatPeriodDate(forecast.periodStart)}~
                          {index === 0 && yearOneMode === "ytd" ? formatPeriodDate(today) : formatPeriodDate(forecast.periodEnd)}
                        </small>
                        <dl>
                          <div>
                            <dt>기대 매출 <FormulaHint formula="해당 Year 예상 소진수량 × 참약사 예상 판매가" /></dt>
                            <dd>{formatCompactWon(forecast.expectedRevenue)}</dd>
                          </div>
                          <div>
                            <dt>매출총이익 <FormulaHint formula="해당 Year 예상 소진수량 × 개당 예상 매출총이익" /></dt>
                            <dd>{formatCompactWon(forecast.expectedGrossProfit)}</dd>
                          </div>
                          <div>
                            <dt>금융비용 차감 <FormulaHint formula="해당 Year 매출총이익 - 해당 Year 연간 금융 기회비용" /></dt>
                            <dd className={forecast.expectedProfitAfterFinance >= 0 ? "positive" : "warning"}>{formatCompactWon(forecast.expectedProfitAfterFinance)}</dd>
                          </div>
                        </dl>
                      </div>
                    ))}
                  </div>
                  <div className="scenario-total-grid">
                    <Metric
                      label="총 매출총이익"
                      value={formatCompactWon(planningTotalExpectedGrossProfit)}
                      subtext={`연간 조달 예상수량 ${formatCount(planningBatchFinance.orderQuantity)} 완전 소진 기준`}
                      tone="positive"
                      formula="연간 조달 예상수량 × 개당 예상 매출총이익"
                    />
                    <Metric
                      label="총 금융비용 차감 기댓값"
                      value={formatCompactWon(planningTotalExpectedProfitAfterFinance)}
                      subtext={`총 금융 기회비용 ${formatWon(planningBatchFinance.totalFinanceCost)} 차감`}
                      tone={planningTotalExpectedProfitAfterFinance >= 0 ? "positive" : "warning"}
                      formula="총 매출총이익 - 총 금융 기회비용"
                    />
                  </div>
                </section>
              </div>

              <section style={{ ...panelStyle, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ color: "#64748b", fontSize: 12 }}>
                  {savedAnalysis.updatedAt ? `마지막 저장: ${new Date(savedAnalysis.updatedAt).toLocaleString("ko-KR")}` : "시장 규모 분석이 아직 저장되지 않았습니다."}
                </div>
                <button
                  type="button"
                  onClick={resetAnalysis}
                  disabled={!savedAnalysis.updatedAt}
                  style={{
                    ...secondaryButtonStyle,
                    color: savedAnalysis.updatedAt ? "#c2410c" : "#94a3b8",
                    borderColor: savedAnalysis.updatedAt ? "#fdba74" : "#e2e8f0",
                    background: savedAnalysis.updatedAt ? "#fff7ed" : "#f8fafc",
                    cursor: savedAnalysis.updatedAt ? "pointer" : "not-allowed"
                  }}
                >
                  시장 규모 분석 초기화
                </button>
              </section>
            </div>
          )}
        </main>
      </div>

      {showDefaultsModal && (
        <div className="market-modal-backdrop" role="presentation" onMouseDown={() => setShowDefaultsModal(false)}>
          <section
            className="market-defaults-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="market-defaults-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="market-defaults-header">
              <div>
                <h2 id="market-defaults-title">시장 규모 분석 기본값</h2>
                <p>기본값을 사용하는 모든 품목에 공통 적용됩니다.</p>
              </div>
              <button type="button" onClick={() => setShowDefaultsModal(false)} aria-label="닫기" className="modal-close-button">×</button>
            </div>
            <div className="condition-grid defaults-condition-grid">
              {[
                ["nationwidePharmacyCount", "전국 약국 수", "예: 25760"],
                ["chamyaksaPharmacyCount", "참약사 약국 수", "예: 500"],
                ["franchisePenetrationRate", "가맹약국 예상 침투율 (%)", "예: 30"],
                ["chamyaksaSellingPriceAdjustmentRate", "참약사 판매가 조정률 (%)", "인하 시 음수"],
                ["manufacturerSellingPriceAdjustmentRate", "제조사 판매가 조정률 (%)", "인하 시 음수"],
                ["annualInterestRate", "연 금융비용 이자율 (%)", "예: 4"]
              ].map(([field, label, placeholder]) => (
                <label key={field}>
                  <span>{label}</span>
                  <input
                    value={defaultsDraft[field]}
                    onChange={(event) => setDefaultsDraft((previous) => ({ ...previous, [field]: event.target.value }))}
                    inputMode="decimal"
                    placeholder={placeholder}
                    style={inputStyle}
                  />
                </label>
              ))}
              <div className="defaults-pricing-note">
                <strong>유통 가격대 기준</strong>
                <span>각 품목에 등록된 첫 번째 기본 가격대를 사용합니다.</span>
              </div>
            </div>
            <div className="market-defaults-actions">
              <button type="button" onClick={() => setShowDefaultsModal(false)} style={secondaryButtonStyle}>취소</button>
              <button type="button" onClick={saveDefaults} style={primaryButtonStyle}>기본값 저장</button>
            </div>
          </section>
        </div>
      )}

      <style jsx>{`
        .market-root { display: grid; gap: 14px; }
        .market-banner-description { margin-top: 5px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .market-layout { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 14px; align-items: start; }
        .market-distribution-filter { min-height: 34px; margin-bottom: 10px; padding: 7px 9px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; display: flex; align-items: center; gap: 7px; color: #334155; cursor: pointer; box-sizing: border-box; font-size: 12px; font-weight: 800; }
        .market-distribution-filter input { width: 16px; height: 16px; margin: 0; accent-color: #2563eb; }
        .market-item-header { display: grid; grid-template-columns: minmax(0, 1fr) max-content; align-items: start; gap: 18px; padding: 14px 15px; background: #e8f1fb; }
        .market-actions { display: grid; grid-auto-flow: column; grid-auto-columns: max-content; justify-content: end; align-items: end; gap: 7px; white-space: nowrap; }
        .market-actions button { min-width: max-content; white-space: nowrap; }
        .market-decision-control { width: 130px; display: grid; gap: 3px; color: #475569; font-size: 11px; font-weight: 900; }
        .market-decision-control select { width: 100% !important; }
        .market-input-grid, .market-result-grid { display: grid; gap: 14px; }
        .market-input-grid { grid-template-columns: minmax(0, 1.25fr) minmax(340px, .75fr); }
        .market-result-grid { grid-template-columns: minmax(0, .82fr) minmax(0, 1.18fr); }
        .forecast-controls { display: flex; align-items: flex-end; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
        .annual-base-date-control { display: grid; gap: 3px; color: #475569; font-size: 11px; font-weight: 800; }
        .section-title { min-height: 58px; padding: 11px 14px; border-bottom: 1px solid #dbe3ee; display: flex; align-items: center; justify-content: space-between; gap: 12px; box-sizing: border-box; background: #f8fafc; }
        .section-title > div { display: grid; gap: 3px; }
        .section-title strong { color: #0f172a; font-size: 15px; }
        .section-title span { color: #64748b; font-size: 11px; }
        .section-title label { display: flex; align-items: center; gap: 8px; color: #475569; font-size: 11px; font-weight: 800; white-space: nowrap; }
        .market-year-table { display: grid; grid-template-columns: 82px minmax(130px, 1fr) minmax(130px, 1fr) minmax(150px, 1.1fr) 86px; gap: 7px; padding: 12px; align-items: center; }
        .market-year-head { color: #475569; font-size: 11px; font-weight: 900; padding: 0 2px 2px; }
        .growth-include-head { text-align: center; }
        .growth-include-cell { min-height: 36px; display: flex; align-items: center; justify-content: center; gap: 5px; color: #475569; font-size: 11px; font-weight: 800; }
        .growth-include-cell input { width: 16px; height: 16px; margin: 0; accent-color: #2563eb; }
        .growth-include-cell input:disabled { cursor: default; }
        .year-total-cell { position: relative; min-height: 36px; border: 1px solid #dbe3ee; border-radius: 6px; background: #f8fafc; overflow: hidden; display: flex; align-items: center; padding: 0 9px; box-sizing: border-box; }
        .year-total-cell i { position: absolute; left: 0; bottom: 0; height: 3px; background: #2563eb; }
        .year-total-cell span { position: relative; z-index: 1; color: #0f172a; font-size: 12px; font-weight: 900; }
        .condition-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px; padding: 13px; }
        .condition-grid label { min-width: 0; }
        .condition-grid label > span { display: block; margin-bottom: 5px; color: #475569; font-size: 11px; font-weight: 800; }
        .growth-period-control { display: inline-flex !important; grid-auto-flow: column; gap: 5px !important; }
        .growth-period-control button { min-height: 30px; padding: 5px 10px; border: 1px solid #cbd5e1; border-radius: 5px; background: #fff; color: #475569; cursor: pointer; font-size: 12px; font-weight: 900; white-space: nowrap; }
        .growth-period-control button.segment-active { border-color: #2563eb; background: #eff6ff; color: #1d4ed8; }
        .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .metric-grid-compact { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .scenario-metric-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .scenario-total-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid #cbd5e1; background: #f8fafc; }
        .forecast-band { border-top: 1px solid #dbe3ee; background: #f8fafc; }
        .forecast-heading { min-height: 58px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .forecast-heading > div:first-child { display: grid; gap: 3px; }
        .forecast-heading strong { color: #0f172a; font-size: 14px; }
        .forecast-heading span { color: #64748b; font-size: 11px; }
        .forecast-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid #dbe3ee; background: #fff; }
        .market-modal-backdrop { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 20px; background: rgba(15, 23, 42, .52); }
        .market-defaults-modal { width: min(620px, 100%); max-height: calc(100vh - 40px); overflow: auto; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; box-shadow: 0 24px 70px rgba(15, 23, 42, .3); }
        .market-defaults-header { padding: 16px; border-bottom: 1px solid #dbe3ee; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .market-defaults-header h2 { margin: 0; color: #0f172a; font-size: 18px; }
        .market-defaults-header p { margin: 5px 0 0; color: #64748b; font-size: 12px; }
        .modal-close-button { width: 32px; height: 32px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #475569; cursor: pointer; font-size: 21px; line-height: 1; }
        .defaults-condition-grid { padding: 16px; }
        .defaults-pricing-note { grid-column: 1 / -1; padding: 11px; border: 1px solid #dbe3ee; border-radius: 6px; background: #f8fafc; display: grid; gap: 4px; }
        .defaults-pricing-note strong { color: #334155; font-size: 12px; }
        .defaults-pricing-note span { color: #64748b; font-size: 11px; }
        .market-defaults-actions { padding: 12px 16px 16px; display: flex; justify-content: flex-end; gap: 8px; }
        :global(.market-metric) { min-height: 96px; padding: 13px; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; display: grid; align-content: center; gap: 6px; box-sizing: border-box; }
        :global(.market-metric span) { color: #64748b; font-size: 11px; font-weight: 800; }
        :global(.market-metric strong) { font-size: 17px; line-height: 1.25; overflow-wrap: anywhere; }
        :global(.market-metric small) { color: #64748b; font-size: 10px; line-height: 1.4; }
        :global(.metric-label-line) { display: flex; align-items: center; gap: 5px; min-width: 0; }
        :global(.formula-hint) { width: 16px; height: 16px; flex: 0 0 16px; display: inline-grid; place-items: center; border: 1px solid #94a3b8; border-radius: 50%; background: #fff; color: #475569 !important; cursor: help; font-size: 10px !important; font-style: normal; font-weight: 900 !important; line-height: 1; }
        :global(.formula-hint:hover), :global(.formula-hint:focus-visible) { border-color: #2563eb; color: #1d4ed8 !important; outline: 2px solid #bfdbfe; outline-offset: 1px; }
        :global(.total-finance-metric) { grid-column: 1 / -1; }
        :global(.scenario-year-metric) { align-content: start; }
        :global(.scenario-year-metric dl) { margin: 2px 0 0; display: grid; gap: 4px; }
        :global(.scenario-year-metric dl div) { display: flex; justify-content: space-between; gap: 8px; padding-top: 4px; border-top: 1px dashed #dbe3ee; }
        :global(.scenario-year-metric dt) { color: #64748b; font-size: 10px; display: inline-flex; align-items: center; gap: 4px; }
        :global(.scenario-year-metric dt .formula-hint) { width: 14px; height: 14px; flex-basis: 14px; font-size: 9px !important; }
        :global(.scenario-year-metric dd) { margin: 0; color: #0f172a; font-size: 11px; font-weight: 900; text-align: right; }
        :global(.scenario-year-metric dd.positive) { color: #047857; }
        :global(.scenario-year-metric dd.warning) { color: #b45309; }
        @media (max-width: 1500px) {
          .market-input-grid, .market-result-grid { grid-template-columns: 1fr; }
          .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .scenario-metric-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }
        @media (max-width: 1250px) {
          .market-item-header { grid-template-columns: 1fr; }
          .market-actions { justify-content: start; }
        }
        @media (max-width: 920px) {
          .market-layout { grid-template-columns: 1fr; }
          .market-layout aside > div:last-child { max-height: 320px !important; }
        }
        @media (max-width: 640px) {
          .market-actions { width: 100%; grid-auto-flow: row; grid-template-columns: 1fr 1fr; }
          .market-decision-control { width: 100%; grid-column: 1 / -1; }
          .market-actions button { width: 100%; }
          .market-year-table { grid-template-columns: 68px minmax(110px, 1fr) minmax(110px, 1fr) minmax(130px, 1fr) 80px; overflow-x: auto; }
          .condition-grid, .metric-grid, .metric-grid-compact, .scenario-metric-grid, .scenario-total-grid, .forecast-grid { grid-template-columns: 1fr; }
          .forecast-heading { align-items: flex-start; flex-direction: column; }
          .forecast-controls { width: 100%; justify-content: flex-start; }
        }
      `}</style>
    </div>
  );
}
