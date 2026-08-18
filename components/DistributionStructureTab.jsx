"use client";

import { useEffect, useMemo, useState } from "react";
import SegmentedDateInput from "@/components/SegmentedDateInput";
import IngredientAmountTitle, { formatIngredientAmountLabel } from "@/components/IngredientAmountTitle";
import { calculateSellingPriceFromMarginRate } from "@/lib/pms/marketAnalysis";
import {
  marketDecisionBadgeStyle,
  marketDecisionLabel
} from "@/lib/pms/marketDecision";
import {
  MISSING_PERMIT_COMPANY_FILTER,
  matchesPermitCompanyFilter,
  permitCompanyFilterOptions
} from "@/lib/pms/permitCompanyFilter";

const panelStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff"
};

const inputStyle = {
  width: "100%",
  minHeight: 38,
  padding: "8px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 7,
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

const secondaryButtonStyle = {
  minHeight: 36,
  padding: "7px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 7,
  background: "#fff",
  color: "#334155",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 800
};

function parseNumber(value) {
  const cleaned = String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatWon(value) {
  if (!Number.isFinite(value)) return "-";
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(Math.round(value))}원`;
}

function formatEnteredPrice(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "-";
  if (/^[\d,\s]+$/.test(raw)) return formatWon(parseNumber(raw));
  return raw;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "-";
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value)}%`;
}

function getItemLabel(item) {
  return formatIngredientAmountLabel(item, item.manufacturer || "성분 미입력");
}

function normalizePricingScenario(value = {}, fallbackId = "pricing_default", fallbackLabel = "기본") {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    id: source.id ?? fallbackId,
    label: String(source.label || fallbackLabel),
    minimumQuantity: String(source.minimumQuantity ?? source.minQuantity ?? ""),
    chamyaksaMarginRate: String(source.chamyaksaMarginRate ?? ""),
    pharmacySellingPrice: String(source.pharmacySellingPrice ?? "")
  };
}

function createPricingScenario(index = 0) {
  return normalizePricingScenario({
    id: `pricing_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label: index === 0 ? "기본" : `가격대 ${index + 1}`,
    minimumQuantity: index === 0 ? "" : String(index * 100)
  });
}

function getDistribution(item) {
  const source = item?.distributionStructure && typeof item.distributionStructure === "object"
    ? item.distributionStructure
    : {};
  const pricingScenarios = (Array.isArray(source.pricingScenarios) ? source.pricingScenarios : [])
    .filter((scenario) => scenario && typeof scenario === "object")
    .map((scenario, index) => normalizePricingScenario(
      scenario,
      `pricing_${index + 1}`,
      index === 0 ? "기본" : `가격대 ${index + 1}`
    ));
  if (pricingScenarios.length === 0) {
    pricingScenarios.push(normalizePricingScenario({
      id: "pricing_default",
      label: "기본",
      chamyaksaMarginRate: source.chamyaksaMarginRate,
      pharmacySellingPrice: source.pharmacySellingPrice
    }));
  }
  return {
    pricingScenarios,
    competitors: Array.isArray(source.competitors) ? source.competitors : [],
    isConfigured: typeof source.isConfigured === "boolean"
      ? source.isConfigured
      : Boolean(source.updatedAt),
    configuredAt: String(source.configuredAt || ""),
    updatedAt: String(source.updatedAt || "")
  };
}

function getBaseAmounts(item) {
  const unitPrice = parseNumber(item?.supplyUnitPrice);
  const quantity = parseNumber(item?.quantity);
  const permitFeeRate = parseNumber(item?.permitCompanyFeeRate);
  const permitFeeRateUnknown = item?.category === "OTC" && item?.permitCompanyFee && item?.permitCompanyFeeRateUnknown;
  const hasKnownPermitFee = item?.category === "OTC" && item?.permitCompanyFee && !permitFeeRateUnknown && permitFeeRate !== null;
  const finalUnitCost = unitPrice === null
    ? null
    : unitPrice * 1.1 * (hasKnownPermitFee ? 1 + (permitFeeRate / 100) : 1);

  return {
    unitPrice,
    quantity,
    vatUnitPrice: unitPrice === null ? null : unitPrice * 1.1,
    supplyTotal: unitPrice === null || quantity === null ? null : unitPrice * quantity,
    vatTotal: unitPrice === null || quantity === null ? null : unitPrice * quantity * 1.1,
    finalUnitCost,
    finalTotal: finalUnitCost === null || quantity === null ? null : finalUnitCost * quantity
  };
}

function createPriceTier(index = 0) {
  return {
    id: `price_tier_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label: index === 0 ? "기본" : `${index * 100}개 이상`,
    price: ""
  };
}

function getCompetitorPriceTiers(competitor = {}) {
  if (Array.isArray(competitor.priceTiers) && competitor.priceTiers.length > 0) return competitor.priceTiers;
  return [{
    id: `${competitor.id || "competitor"}_legacy_price`,
    label: "기본",
    price: String(competitor.salePrice ?? "")
  }];
}

function createCompetitor() {
  return {
    id: `competitor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date: "",
    productName: "",
    salesChannel: "",
    packagingUnit: "",
    salePrice: "",
    priceTiers: [createPriceTier()],
    memo: ""
  };
}

export default function DistributionStructureTab({
  items = [],
  categories = [],
  selectedCategory = "all",
  selectedItemId,
  onSelectedItemChange,
  onUpdateItem,
  onOpenSupply,
  onOpenMarket,
  syncState
}) {
  const [search, setSearch] = useState("");
  const [permitCompanyFilter, setPermitCompanyFilter] = useState("all");
  const [adoptionStatusFilter, setAdoptionStatusFilter] = useState("all");
  const [structureStatusFilter, setStructureStatusFilter] = useState("all");
  const [editingItemId, setEditingItemId] = useState(null);
  const [activePricingScenarioId, setActivePricingScenarioId] = useState(null);
  const query = search.trim().toLowerCase();
  const categoryItems = useMemo(() => (
    selectedCategory === "all" ? items : items.filter((item) => item.category === selectedCategory)
  ), [items, selectedCategory]);
  const permitCompanyOptions = useMemo(
    () => permitCompanyFilterOptions(categoryItems),
    [categoryItems]
  );
  useEffect(() => {
    if (permitCompanyFilter === "all" || permitCompanyFilter === MISSING_PERMIT_COMPANY_FILTER) return;
    if (!permitCompanyOptions.includes(permitCompanyFilter)) setPermitCompanyFilter("all");
  }, [permitCompanyFilter, permitCompanyOptions]);
  const visibleItems = useMemo(() => {
    const permitCompanyItems = categoryItems.filter((item) => matchesPermitCompanyFilter(item, permitCompanyFilter));
    const adoptionItems = adoptionStatusFilter === "all"
      ? permitCompanyItems
      : permitCompanyItems.filter((item) => (
          adoptionStatusFilter === "expected"
            ? Boolean(item.quoteAdoptionExpected)
            : !item.quoteAdoptionExpected
        ));
    const structureItems = structureStatusFilter === "all"
      ? adoptionItems
      : adoptionItems.filter((item) => {
          const isConfigured = getDistribution(item).isConfigured;
          return structureStatusFilter === "configured" ? isConfigured : !isConfigured;
        });
    if (!query) return structureItems;
    return structureItems.filter((item) => {
      const haystack = [
        item.manufacturer,
        item.packagingUnit,
        ...(item.ingredients || []).flatMap((ingredient) => [ingredient.name, ingredient.content])
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [adoptionStatusFilter, categoryItems, permitCompanyFilter, query, structureStatusFilter]);

  useEffect(() => {
    if (visibleItems.length === 0) return;
    const selectedItemIsVisible = visibleItems.some((item) => String(item.id) === String(selectedItemId));
    if (!selectedItemIsVisible) onSelectedItemChange?.(visibleItems[0].id);
  }, [onSelectedItemChange, selectedItemId, visibleItems]);

  const selectedItem = visibleItems.find((item) => String(item.id) === String(selectedItemId)) || visibleItems[0] || null;
  const isEditing = selectedItem && String(editingItemId) === String(selectedItem.id);
  const distribution = getDistribution(selectedItem);
  const activePricingScenario = distribution.pricingScenarios.find((scenario) => (
    String(scenario.id) === String(activePricingScenarioId)
  )) || distribution.pricingScenarios[0];
  const baseAmounts = getBaseAmounts(selectedItem);
  const hasPermitCompanyFee = selectedItem?.category === "OTC" && selectedItem?.permitCompanyFee;
  const permitFeeRate = parseNumber(selectedItem?.permitCompanyFeeRate);
  const permitFeeRateUnknown = hasPermitCompanyFee && selectedItem?.permitCompanyFeeRateUnknown;
  const permitFeeStatus = !hasPermitCompanyFee
    ? "불포함"
    : (permitFeeRateUnknown || permitFeeRate === null ? "알 수 없음" : formatPercent(permitFeeRate));
  const permitFeeApplied = hasPermitCompanyFee && (permitFeeRateUnknown || permitFeeRate !== null);
  const chamyaksaMarginRate = parseNumber(activePricingScenario?.chamyaksaMarginRate);
  const marginRateIsValid = chamyaksaMarginRate !== null
    && chamyaksaMarginRate >= 0
    && chamyaksaMarginRate < 100;
  const chamyaksaSellingPrice = calculateSellingPriceFromMarginRate(
    baseAmounts.finalUnitCost,
    chamyaksaMarginRate
  );
  const chamyaksaMarginAmount = chamyaksaSellingPrice === null || baseAmounts.finalUnitCost === null
    ? null
    : chamyaksaSellingPrice - baseAmounts.finalUnitCost;
  const pharmacySellingPrice = parseNumber(activePricingScenario?.pharmacySellingPrice);
  const pharmacyMarginAmount = pharmacySellingPrice === null || chamyaksaSellingPrice === null
    ? null
    : pharmacySellingPrice - chamyaksaSellingPrice;
  const pharmacyMarginRate = pharmacySellingPrice && pharmacyMarginAmount !== null
    ? (pharmacyMarginAmount / pharmacySellingPrice) * 100
    : null;
  const categoryLabelById = Object.fromEntries(categories.map((category) => [category.id, category.label]));

  const updateDistribution = (patch) => {
    if (!selectedItem) return;
    onUpdateItem?.(selectedItem.id, {
      distributionStructure: {
        ...distribution,
        ...patch,
        updatedAt: new Date().toISOString()
      }
    });
  };

  const updatePricingScenario = (patch) => {
    if (!activePricingScenario) return;
    updateDistribution({
      pricingScenarios: distribution.pricingScenarios.map((scenario) => (
        String(scenario.id) === String(activePricingScenario.id) ? { ...scenario, ...patch } : scenario
      ))
    });
  };

  const addPricingScenario = () => {
    const nextScenario = createPricingScenario(distribution.pricingScenarios.length);
    updateDistribution({ pricingScenarios: [...distribution.pricingScenarios, nextScenario] });
    setActivePricingScenarioId(nextScenario.id);
  };

  const removeActivePricingScenario = () => {
    if (!activePricingScenario || distribution.pricingScenarios.length <= 1) {
      window.alert("가격대 탭은 최소 1개가 필요합니다.");
      return;
    }
    if (!window.confirm(`"${activePricingScenario.label || "가격대"}" 탭을 삭제하시겠습니까?`)) return;
    const nextScenarios = distribution.pricingScenarios.filter((scenario) => (
      String(scenario.id) !== String(activePricingScenario.id)
    ));
    updateDistribution({ pricingScenarios: nextScenarios });
    setActivePricingScenarioId(nextScenarios[0]?.id || null);
  };

  const resetDistributionStructure = () => {
    if (!selectedItem || !distribution.updatedAt) return;
    if (!window.confirm(
      "이 공급단가 건의 판매가·마진 설정과 경쟁제품 비교 내용을 모두 초기화하시겠습니까?\n초기화 후 유통 구조 미설정 상태로 돌아갑니다."
    )) return;
    onUpdateItem?.(selectedItem.id, { distributionStructure: {} });
    setActivePricingScenarioId(null);
    setEditingItemId(null);
  };

  const completeDistributionStructure = () => {
    if (!selectedItem || distribution.isConfigured) return;
    updateDistribution({
      isConfigured: true,
      configuredAt: new Date().toISOString()
    });
  };

  const updateCompetitor = (competitorId, patch) => {
    updateDistribution({
      competitors: distribution.competitors.map((competitor) => (
        String(competitor.id) === String(competitorId) ? { ...competitor, ...patch } : competitor
      ))
    });
  };

  const updateCompetitorPriceTier = (competitorId, tierId, patch) => {
    const competitor = distribution.competitors.find((entry) => String(entry.id) === String(competitorId));
    if (!competitor) return;
    const priceTiers = getCompetitorPriceTiers(competitor).map((tier) => (
      String(tier.id) === String(tierId) ? { ...tier, ...patch } : tier
    ));
    updateCompetitor(competitorId, {
      priceTiers,
      salePrice: priceTiers[0]?.price || ""
    });
  };

  const addCompetitorPriceTier = (competitorId) => {
    const competitor = distribution.competitors.find((entry) => String(entry.id) === String(competitorId));
    if (!competitor) return;
    const priceTiers = getCompetitorPriceTiers(competitor);
    updateCompetitor(competitorId, {
      priceTiers: [...priceTiers, createPriceTier(priceTiers.length)],
      salePrice: priceTiers[0]?.price || ""
    });
  };

  const removeCompetitorPriceTier = (competitorId, tierId) => {
    const competitor = distribution.competitors.find((entry) => String(entry.id) === String(competitorId));
    if (!competitor) return;
    const priceTiers = getCompetitorPriceTiers(competitor).filter((tier) => String(tier.id) !== String(tierId));
    updateCompetitor(competitorId, {
      priceTiers,
      salePrice: priceTiers[0]?.price || ""
    });
  };

  return (
    <div className="distribution-root">
      <section style={{ ...panelStyle, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, color: "#0f172a", fontSize: 23 }}>유통 구조 설정</h1>
            <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 14 }}>
              공급단가를 기준으로 참약사와 약국의 판매가 및 마진 구조를 건별로 설정합니다.
            </p>
          </div>
          <div style={{ color: syncState?.status === "error" ? "#dc2626" : "#059669", fontSize: 12, fontWeight: 800, textAlign: "right" }}>
            {syncState?.message || "변경 내용 자동 저장"}
          </div>
        </div>
      </section>

      <div className="distribution-layout">
        <aside style={{ ...panelStyle, minWidth: 0, overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #dbe3ee", background: "#f8fafc" }}>
            <label htmlFor="distribution-search" style={labelStyle}>공급단가 건 검색</label>
            <div style={{ marginBottom: 7, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <label
                htmlFor="distribution-adoption-filter"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  color: "#475569",
                  whiteSpace: "nowrap",
                  fontSize: 11,
                  fontWeight: 800
                }}
              >
                채택
                <select
                  id="distribution-adoption-filter"
                  value={adoptionStatusFilter}
                  onChange={(event) => setAdoptionStatusFilter(event.target.value)}
                  style={{
                    minHeight: 30,
                    padding: "4px 25px 4px 7px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#fff",
                    color: "#334155",
                    fontSize: 11,
                    fontWeight: 800
                  }}
                >
                  <option value="all">전체</option>
                  <option value="expected">채택 예상</option>
                  <option value="reconsider">채택 재고</option>
                </select>
              </label>
              <label
                htmlFor="distribution-structure-status-filter"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  color: "#475569",
                  whiteSpace: "nowrap",
                  fontSize: 11,
                  fontWeight: 800
                }}
              >
                구조
                <select
                  id="distribution-structure-status-filter"
                  value={structureStatusFilter}
                  onChange={(event) => setStructureStatusFilter(event.target.value)}
                  style={{
                    minHeight: 30,
                    padding: "4px 25px 4px 7px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    background: "#fff",
                    color: "#334155",
                    fontSize: 11,
                    fontWeight: 800
                  }}
                >
                  <option value="all">전체</option>
                  <option value="configured">설정됨</option>
                  <option value="unconfigured">미설정</option>
                </select>
              </label>
            </div>
            <select
              value={permitCompanyFilter}
              onChange={(event) => setPermitCompanyFilter(event.target.value)}
              aria-label="허가사 필터"
              style={{ ...inputStyle, minHeight: 34, marginBottom: 7, fontSize: 12 }}
            >
              <option value="all">전체 허가사</option>
              {permitCompanyOptions.map((permitCompany) => <option key={permitCompany} value={permitCompany}>{permitCompany}</option>)}
              <option value={MISSING_PERMIT_COMPANY_FILTER}>허가사 미입력</option>
            </select>
            <input
              id="distribution-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="성분명 또는 제조사"
              style={inputStyle}
            />
          </div>
          <div style={{ maxHeight: "calc(100vh - 236px)", overflowY: "auto", padding: 8 }}>
            {visibleItems.map((item) => {
              const active = selectedItem && String(item.id) === String(selectedItem.id);
              const structure = getDistribution(item);
              const fullLabel = getItemLabel(item);
              return (
                <button
                  key={item.id}
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
                    <IngredientAmountTitle label={fullLabel} maxFontSize={14} minFontSize={12} />
                    <span style={{ flex: "0 0 auto", color: "#64748b", fontSize: 11 }}>
                      {categoryLabelById[item.category] || item.category}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>
                    {item.manufacturer || "제조사 미입력"} · {item.quoteDate || "견적일 미입력"}
                  </div>
                  <div style={{ marginTop: 3, color: "#475569", fontSize: 11, fontWeight: 700 }}>
                    포장단위: {item.packagingUnit || "미입력"}
                    {item.packagingForm ? ` · 포장형태: ${item.packagingForm}` : ""}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 7, marginTop: 5, fontSize: 11, fontWeight: 700 }}>
                    <span style={{ color: structure.isConfigured ? "#047857" : "#94a3b8" }}>
                      {structure.isConfigured ? "유통 구조 설정됨" : "유통 구조 미설정"}
                    </span>
                    <span style={{ color: item.quoteAdoptionExpected ? "#047857" : "#b45309" }}>
                      {item.quoteAdoptionExpected ? "채택 예상" : "채택 재고"}
                    </span>
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
                표시할 공급단가 건이 없습니다.
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
              <div className="decision-grid">
              <section style={panelStyle}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "13px 15px", borderBottom: "1px solid #cbd5e1", background: "#e8f1fb" }}>
                  <div style={{ minWidth: 0 }}>
                    <IngredientAmountTitle item={selectedItem} fallback={selectedItem.manufacturer || "성분 미입력"} maxFontSize={17} minFontSize={12} />
                    <div style={{ marginTop: 3, color: "#64748b", fontSize: 12 }}>
                      {selectedItem.manufacturer || "제조사 미입력"} · {categoryLabelById[selectedItem.category] || selectedItem.category}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 7, flex: "0 0 auto", flexWrap: "wrap" }}>
                    <span style={{
                      padding: "4px 8px",
                      borderRadius: 5,
                      border: `1px solid ${selectedItem.quoteAdoptionExpected ? "#a7f3d0" : "#fde68a"}`,
                      background: selectedItem.quoteAdoptionExpected ? "#ecfdf5" : "#fffbeb",
                      color: selectedItem.quoteAdoptionExpected ? "#047857" : "#b45309",
                      fontSize: 12,
                      fontWeight: 900
                    }}>
                      {selectedItem.quoteAdoptionExpected ? "채택 예상" : "채택 재고"}
                    </span>
                    <span style={marketDecisionBadgeStyle(selectedItem.marketDecisionStatus)}>
                      검토결과 · {marketDecisionLabel(selectedItem.marketDecisionStatus)}
                    </span>
                    <div style={{ display: "grid", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => onOpenSupply?.(selectedItem.id)}
                        style={{
                          minHeight: 32,
                          padding: "6px 11px",
                          border: "1px solid #93c5fd",
                          borderRadius: 6,
                          background: "#fff",
                          color: "#1d4ed8",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 900,
                          whiteSpace: "nowrap"
                        }}
                      >
                        공급단가 보기
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenMarket?.(selectedItem.id)}
                        style={{
                          minHeight: 32,
                          padding: "6px 11px",
                          border: "1px solid #86efac",
                          borderRadius: 6,
                          background: "#f0fdf4",
                          color: "#047857",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 900,
                          whiteSpace: "nowrap"
                        }}
                      >
                        시장 규모 분석
                      </button>
                    </div>
                  </div>
                </div>
                <div className="base-grid">
                  {[
                    ["포장단위", selectedItem.packagingUnit || "-", selectedItem.packagingForm ? `포장형태: ${selectedItem.packagingForm}` : ""],
                    ["배치 당 포장단위 개수", selectedItem.quantity || "-", ""],
                    ["배치 당 공급단가", formatWon(baseAmounts.unitPrice), `총 금액: ${formatWon(baseAmounts.supplyTotal)}`],
                    ["배치 당 VAT 포함 가격", formatWon(baseAmounts.vatUnitPrice), `VAT 포함 총금액: ${formatWon(baseAmounts.vatTotal)}`],
                    [
                      "허가사 수수료",
                      permitFeeStatus,
                      hasPermitCompanyFee
                        ? `허가사: ${selectedItem.permitCompany || "미입력"}${permitFeeRateUnknown ? "\n공급단가에 포함" : ""}`
                        : ""
                    ],
                    ["최종 유통 원가", formatWon(baseAmounts.finalTotal), `${permitFeeApplied ? (permitFeeRateUnknown ? "VAT 반영 · 허가사 수수료는 공급단가에 포함" : "VAT 및 허가사 수수료 반영") : "VAT 반영"} · 개당: ${formatWon(baseAmounts.finalUnitCost)}`]
                  ].map(([label, value, subtext]) => (
                    <div key={label} style={{ padding: 13, borderRight: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
                      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{label}</div>
                      <div style={{ marginTop: 7, color: "#0f172a", fontSize: 16, fontWeight: 900 }}>{value}</div>
                      {subtext && <div style={{ marginTop: 4, color: "#64748b", fontSize: 11, whiteSpace: "pre-line" }}>{subtext}</div>}
                    </div>
                  ))}
                </div>
              </section>

              <section style={panelStyle}>
                <div style={{ padding: "12px 15px", borderBottom: "1px solid #cbd5e1" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ color: "#0f172a", fontSize: 16, fontWeight: 900 }}>판매가 및 마진 설정</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <button
                        type="button"
                        onClick={completeDistributionStructure}
                        disabled={distribution.isConfigured}
                        style={{
                          minHeight: 32,
                          padding: "5px 10px",
                          border: `1px solid ${distribution.isConfigured ? "#a7f3d0" : "#2563eb"}`,
                          borderRadius: 6,
                          background: distribution.isConfigured ? "#ecfdf5" : "#2563eb",
                          color: distribution.isConfigured ? "#047857" : "#fff",
                          cursor: distribution.isConfigured ? "default" : "pointer",
                          fontSize: 12,
                          fontWeight: 900,
                          whiteSpace: "nowrap"
                        }}
                      >
                        {distribution.isConfigured ? "설정 완료됨" : "설정 완료"}
                      </button>
                      <button type="button" onClick={addPricingScenario} style={{ ...secondaryButtonStyle, minHeight: 32, padding: "5px 9px", fontSize: 12 }}>
                        + 가격대 탭 추가
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: 4, color: "#475569", fontSize: 12, lineHeight: 1.5 }}>
                    모든 금액은 VAT 포함 기준입니다.
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", borderBottom: "1px solid #dbe3ee", background: "#f8fafc", overflowX: "auto" }}>
                  {distribution.pricingScenarios.map((scenario, index) => {
                    const active = String(scenario.id) === String(activePricingScenario?.id);
                    return (
                      <button
                        key={scenario.id}
                        type="button"
                        onClick={() => setActivePricingScenarioId(scenario.id)}
                        title={scenario.minimumQuantity ? `${scenario.minimumQuantity}개 이상 적용` : "기본 가격대"}
                        style={{
                          minHeight: 32,
                          padding: "5px 10px",
                          border: `1px solid ${active ? "#2563eb" : "#cbd5e1"}`,
                          borderRadius: 6,
                          background: active ? "#eff6ff" : "#fff",
                          color: active ? "#1d4ed8" : "#475569",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 800,
                          whiteSpace: "nowrap"
                        }}
                      >
                        {scenario.label || `가격대 ${index + 1}`}
                        {scenario.minimumQuantity ? ` · ${scenario.minimumQuantity}개 이상` : ""}
                      </button>
                    );
                  })}
                </div>
                <div className="margin-grid">
                  <div>
                    <label style={labelStyle}>가격대 탭 이름</label>
                    <input
                      value={activePricingScenario?.label || ""}
                      onChange={(event) => updatePricingScenario({ label: event.target.value })}
                      placeholder="예: 기본, 대량구매"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>적용 물량 (개 이상)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={activePricingScenario?.minimumQuantity || ""}
                      onChange={(event) => updatePricingScenario({ minimumQuantity: event.target.value })}
                      placeholder="기본 가격대는 비워두기"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>참약사 목표 마진율 (판매가 기준, %)</label>
                    <input
                      value={activePricingScenario?.chamyaksaMarginRate || ""}
                      onChange={(event) => updatePricingScenario({ chamyaksaMarginRate: event.target.value })}
                      inputMode="decimal"
                      placeholder="예: 60"
                      style={inputStyle}
                    />
                    {activePricingScenario?.chamyaksaMarginRate && !marginRateIsValid && (
                      <div style={{ marginTop: 5, color: "#dc2626", fontSize: 11 }}>0 이상 100 미만의 숫자를 입력해주세요.</div>
                    )}
                    <div style={{ marginTop: 5, color: "#64748b", fontSize: 11 }}>
                      목표 마진율 = 참약사 마진금액 ÷ 참약사 판매가
                    </div>
                  </div>
                  <div className="calculated-cell">
                    <span>참약사 마진금액 (VAT 포함)</span>
                    <strong>{formatWon(chamyaksaMarginAmount)}</strong>
                  </div>
                  <div className="calculated-cell">
                    <span>참약사 판매가 (VAT 포함)</span>
                    <strong>{formatWon(chamyaksaSellingPrice)}</strong>
                    <small style={{ color: "#64748b", fontWeight: 700 }}>약국 사입 금액</small>
                  </div>
                  <div>
                    <label style={labelStyle}>약국 판매가 (VAT 포함)</label>
                    <input
                      value={activePricingScenario?.pharmacySellingPrice || ""}
                      onChange={(event) => updatePricingScenario({ pharmacySellingPrice: event.target.value })}
                      inputMode="numeric"
                      placeholder="예: 15,000"
                      style={inputStyle}
                    />
                  </div>
                  <div className="calculated-cell">
                    <span>약국 마진율 (판매가 기준)</span>
                    <strong style={{ color: pharmacyMarginAmount !== null && pharmacyMarginAmount < 0 ? "#dc2626" : "#0f172a" }}>
                      {formatPercent(pharmacyMarginRate)}
                    </strong>
                  </div>
                  <div className="calculated-cell">
                    <span>약국 마진금액 (VAT 포함)</span>
                    <strong style={{ color: pharmacyMarginAmount !== null && pharmacyMarginAmount < 0 ? "#dc2626" : "#0f172a" }}>
                      {formatWon(pharmacyMarginAmount)}
                    </strong>
                  </div>
                  <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={resetDistributionStructure}
                      disabled={!distribution.updatedAt}
                      style={{
                        ...secondaryButtonStyle,
                        color: distribution.updatedAt ? "#c2410c" : "#94a3b8",
                        borderColor: distribution.updatedAt ? "#fdba74" : "#e2e8f0",
                        background: distribution.updatedAt ? "#fff7ed" : "#f8fafc",
                        cursor: distribution.updatedAt ? "pointer" : "not-allowed",
                        opacity: distribution.updatedAt ? 1 : 0.65
                      }}
                    >
                      유통 구조 설정 초기화
                    </button>
                    <button
                      type="button"
                      onClick={removeActivePricingScenario}
                      disabled={distribution.pricingScenarios.length <= 1}
                      style={{
                        ...secondaryButtonStyle,
                        color: distribution.pricingScenarios.length <= 1 ? "#94a3b8" : "#dc2626",
                        borderColor: distribution.pricingScenarios.length <= 1 ? "#e2e8f0" : "#fecaca",
                        cursor: distribution.pricingScenarios.length <= 1 ? "not-allowed" : "pointer",
                        opacity: distribution.pricingScenarios.length <= 1 ? 0.65 : 1
                      }}
                    >
                      현재 가격대 탭 삭제
                    </button>
                  </div>
                </div>
              </section>

              <section className="competitor-panel" style={panelStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 15px", borderBottom: "1px solid #cbd5e1" }}>
                  <div>
                    <div style={{ color: "#0f172a", fontSize: 16, fontWeight: 900 }}>경쟁제품 비교</div>
                    <div style={{ marginTop: 2, color: "#64748b", fontSize: 12 }}>동일 시장 제품의 판매 조건을 간단히 기록합니다.</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => updateDistribution({ competitors: [...distribution.competitors, createCompetitor()] })}
                        style={secondaryButtonStyle}
                      >
                        + 경쟁제품 추가
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingItemId(isEditing ? null : selectedItem.id)}
                      style={isEditing
                        ? { ...secondaryButtonStyle, background: "#0f172a", borderColor: "#0f172a", color: "#fff" }
                        : secondaryButtonStyle}
                    >
                      {isEditing ? "완료" : "수정"}
                    </button>
                  </div>
                </div>
                <div>
                  <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: "10%" }} />
                      <col style={{ width: isEditing ? "21%" : "24%" }} />
                      <col style={{ width: isEditing ? "14%" : "16%" }} />
                      <col style={{ width: "11%" }} />
                      <col style={{ width: "22%" }} />
                      <col style={{ width: isEditing ? "16%" : "17%" }} />
                      {isEditing && <col style={{ width: "6%" }} />}
                    </colgroup>
                    <thead>
                      <tr style={{ background: "#f1f5f9" }}>
                        {["기준일", "경쟁제품명", "판매처", "포장단위", "판매단가", "비고", ...(isEditing ? ["관리"] : [])].map((header) => (
                          <th key={header} style={{ padding: "9px 10px", borderBottom: "1px solid #dbe3ee", color: "#475569", fontSize: 12, textAlign: "left" }}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {distribution.competitors.map((competitor) => (
                        <tr key={competitor.id}>
                          <td style={{ padding: 7, borderBottom: "1px solid #edf2f7" }}>
                            {isEditing ? (
                              <SegmentedDateInput
                                value={competitor.date || ""}
                                onChange={(value) => updateCompetitor(competitor.id, { date: value })}
                                aria-label={`${competitor.productName || "경쟁제품"} 기준일`}
                                style={inputStyle}
                              />
                            ) : (
                              <div style={labelStyle}>{competitor.date || "-"}</div>
                            )}
                          </td>
                          <td style={{ padding: 7, borderBottom: "1px solid #edf2f7" }}>
                            {isEditing ? (
                              <input value={competitor.productName || ""} onChange={(event) => updateCompetitor(competitor.id, { productName: event.target.value })} placeholder="경쟁제품명" style={inputStyle} />
                            ) : (
                              <div style={{ color: "#0f172a", fontSize: 13, fontWeight: 700 }}>{competitor.productName || "-"}</div>
                            )}
                          </td>
                          <td style={{ padding: 7, borderBottom: "1px solid #edf2f7" }}>
                            {isEditing ? (
                              <input value={competitor.salesChannel || ""} onChange={(event) => updateCompetitor(competitor.id, { salesChannel: event.target.value })} placeholder="판매처" style={inputStyle} />
                            ) : (
                              <div style={{ color: "#334155", fontSize: 13, overflowWrap: "anywhere" }}>{competitor.salesChannel || "-"}</div>
                            )}
                          </td>
                          <td style={{ padding: 7, borderBottom: "1px solid #edf2f7" }}>
                            {isEditing ? (
                              <input value={competitor.packagingUnit || ""} onChange={(event) => updateCompetitor(competitor.id, { packagingUnit: event.target.value })} placeholder="예: 30정" style={inputStyle} />
                            ) : (
                              <div style={{ color: "#334155", fontSize: 13 }}>{competitor.packagingUnit || "-"}</div>
                            )}
                          </td>
                          <td style={{ padding: 7, borderBottom: "1px solid #edf2f7" }}>
                            {isEditing ? (
                              <div style={{ display: "grid", gap: 6 }}>
                                {getCompetitorPriceTiers(competitor).map((tier, tierIndex) => (
                                  <div key={tier.id} style={{ display: "grid", gridTemplateColumns: "minmax(88px, 1fr) minmax(96px, 1fr) auto", gap: 5, alignItems: "center" }}>
                                    <input
                                      value={tier.label || ""}
                                      onChange={(event) => updateCompetitorPriceTier(competitor.id, tier.id, { label: event.target.value })}
                                      placeholder={tierIndex === 0 ? "기본" : "예: 100개 이상"}
                                      style={{ ...inputStyle, minHeight: 34, padding: "6px 8px", fontSize: 12 }}
                                    />
                                    <input
                                      value={tier.price || ""}
                                      onChange={(event) => updateCompetitorPriceTier(competitor.id, tier.id, { price: event.target.value })}
                                      inputMode="numeric"
                                      placeholder="판매단가"
                                      style={{ ...inputStyle, minHeight: 34, padding: "6px 8px", fontSize: 12 }}
                                    />
                                    {tierIndex > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => removeCompetitorPriceTier(competitor.id, tier.id)}
                                        title="할인구간 삭제"
                                        aria-label="할인구간 삭제"
                                        style={{ ...secondaryButtonStyle, minHeight: 34, padding: "5px 8px", color: "#dc2626", borderColor: "#fecaca" }}
                                      >
                                        삭제
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => addCompetitorPriceTier(competitor.id)}
                                  style={{ ...secondaryButtonStyle, minHeight: 32, padding: "5px 8px", justifySelf: "start", fontSize: 12 }}
                                >
                                  + 할인구간
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: "grid", gap: 5 }}>
                                {getCompetitorPriceTiers(competitor).map((tier) => (
                                  <div key={tier.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, paddingBottom: 4, borderBottom: "1px dashed #dbe3ee", color: "#334155", fontSize: 12 }}>
                                    <span>{tier.label || "구간 미입력"}</span>
                                    <strong style={{ color: "#0f172a", whiteSpace: "nowrap" }}>{formatEnteredPrice(tier.price)}</strong>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: 7, borderBottom: "1px solid #edf2f7" }}>
                            {isEditing ? (
                              <textarea
                                value={competitor.memo || ""}
                                onChange={(event) => updateCompetitor(competitor.id, { memo: event.target.value })}
                                placeholder="비고"
                                rows={2}
                                style={{ ...inputStyle, minHeight: 66, resize: "vertical", fontFamily: "inherit" }}
                              />
                            ) : (
                              <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{competitor.memo || "-"}</div>
                            )}
                          </td>
                          {isEditing && <td style={{ padding: 7, borderBottom: "1px solid #edf2f7" }}>
                            <button
                              type="button"
                              onClick={() => updateDistribution({ competitors: distribution.competitors.filter((entry) => String(entry.id) !== String(competitor.id)) })}
                              style={{ ...secondaryButtonStyle, color: "#dc2626", borderColor: "#fecaca" }}
                            >
                              삭제
                            </button>
                          </td>}
                        </tr>
                      ))}
                      {distribution.competitors.length === 0 && (
                        <tr>
                            <td colSpan={isEditing ? 7 : 6} style={{ padding: 20, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
                            등록된 경쟁제품이 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
              </div>
            </div>
          )}
        </main>
      </div>

      <style jsx>{`
        .distribution-root {
          display: grid;
          gap: 14px;
        }
        .distribution-layout {
          display: grid;
          grid-template-columns: minmax(250px, 320px) minmax(0, 1fr);
          gap: 14px;
          align-items: start;
        }
        .base-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          grid-auto-rows: 1fr;
          height: 100%;
        }
        .decision-grid {
          display: grid;
          grid-template-columns: minmax(390px, 0.9fr) minmax(540px, 1.1fr);
          gap: 14px;
          align-items: stretch;
        }
        .decision-grid > section:not(.competitor-panel) {
          display: grid;
          grid-template-rows: auto 1fr;
        }
        .competitor-panel {
          grid-column: 1 / -1;
          min-width: 0;
        }
        .margin-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          padding: 15px;
          align-items: stretch;
        }
        .calculated-cell {
          min-height: 66px;
          padding: 10px 12px;
          border: 1px solid #dbe3ee;
          border-radius: 7px;
          background: #f8fafc;
          display: grid;
          align-content: center;
          gap: 4px;
        }
        .calculated-cell span {
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }
        .calculated-cell strong {
          color: #0f172a;
          font-size: 17px;
        }
        .calculated-cell small {
          color: #64748b;
          font-size: 11px;
        }
        @media (max-width: 1500px) {
          .decision-grid {
            grid-template-columns: 1fr;
          }
          .margin-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 1050px) {
          .distribution-layout {
            grid-template-columns: 1fr;
          }
          .distribution-layout aside > div:last-child {
            max-height: 280px !important;
          }
        }
        @media (max-width: 760px) {
          .base-grid,
          .margin-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
