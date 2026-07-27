"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateMarketAnalysis, normalizeMarketSizeAnalysis } from "@/lib/pms/marketAnalysis";

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

function validateAnalysis(analysis) {
  const numericFields = [
    ["달러 환율", analysis.exchangeRate],
    ["전국 약국 수", analysis.nationwidePharmacyCount],
    ["참약사 약국 수", analysis.chamyaksaPharmacyCount],
    ["가맹약국 침투율", analysis.franchisePenetrationRate],
    ["공급단가 조정률", analysis.supplyPriceAdjustmentRate],
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
  const adjustment = Number(analysis.supplyPriceAdjustmentRate);
  if (String(analysis.supplyPriceAdjustmentRate).trim() && adjustment <= -100) {
    throw new Error("공급단가 조정률은 -100%보다 커야 합니다.");
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

function Metric({ label, value, subtext, tone = "default" }) {
  const color = tone === "positive" ? "#047857" : (tone === "warning" ? "#b45309" : "#0f172a");
  return (
    <div className="market-metric">
      <span>{label}</span>
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
  onOpenSupply,
  onOpenDistribution,
  syncState
}) {
  const [search, setSearch] = useState("");
  const [editingItemId, setEditingItemId] = useState(null);
  const [draft, setDraft] = useState(null);
  const query = search.trim().toLowerCase();
  const categoryLabelById = Object.fromEntries(categories.map((category) => [category.id, category.label]));
  const visibleItems = useMemo(() => {
    const categoryItems = selectedCategory === "all"
      ? items
      : items.filter((item) => item.category === selectedCategory);
    if (!query) return categoryItems;
    return categoryItems.filter((item) => [
      item.manufacturer,
      item.packagingUnit,
      ...(item.ingredients || []).flatMap((ingredient) => [ingredient.name, ingredient.content])
    ].join(" ").toLowerCase().includes(query));
  }, [items, query, selectedCategory]);

  const selectedItem = visibleItems.find((item) => String(item.id) === String(selectedItemId)) || visibleItems[0] || null;
  const savedAnalysis = normalizeMarketSizeAnalysis(selectedItem?.marketSizeAnalysis);
  const isEditing = selectedItem && String(editingItemId) === String(selectedItem.id);
  const workingAnalysis = isEditing && draft ? draft : savedAnalysis;
  const calculations = calculateMarketAnalysis(selectedItem, workingAnalysis);
  const pricingScenarios = Array.isArray(selectedItem?.distributionStructure?.pricingScenarios)
    ? selectedItem.distributionStructure.pricingScenarios
    : [];
  const maxYearTotal = Math.max(1, ...calculations.yearResults.map((entry) => entry.totalKrw));

  useEffect(() => {
    setEditingItemId(null);
    setDraft(null);
  }, [selectedItem?.id]);

  const beginEdit = () => {
    if (!selectedItem) return;
    setEditingItemId(selectedItem.id);
    setDraft(normalizeMarketSizeAnalysis(selectedItem.marketSizeAnalysis));
  };

  const updateDraft = (patch) => {
    setDraft((previous) => ({ ...normalizeMarketSizeAnalysis(previous), ...patch }));
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
      onUpdateItem?.(selectedItem.id, {
        marketSizeAnalysis: {
          ...normalizeMarketSizeAnalysis(draft),
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
          <div>
            <h1 style={{ margin: 0, color: "#0f172a", fontSize: 23 }}>시장 규모 분석</h1>
            <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 14 }}>
              공급단가 건별 시장 실적, 약국 침투율, 배치 소진과 금융비용을 분석합니다.
            </p>
          </div>
          <div style={{ color: syncState?.status === "error" ? "#dc2626" : "#059669", fontSize: 12, fontWeight: 800, textAlign: "right" }}>
            {syncState?.message || "변경 내용 자동 저장"}
          </div>
        </div>
      </section>

      <div className="market-layout">
        <aside style={{ ...panelStyle, minWidth: 0, overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #dbe3ee", background: "#f8fafc" }}>
            <label htmlFor="market-search" style={labelStyle}>공급단가 건 검색</label>
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
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectedItemChange?.(item.id)}
                  style={{
                    width: "100%",
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
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14 }}>
                      {getItemLabel(item)}
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
                  </div>
                  <div style={{ marginTop: 5, color: market.updatedAt ? "#047857" : "#94a3b8", fontSize: 11, fontWeight: 800 }}>
                    {market.updatedAt ? "시장 분석 설정됨" : "시장 분석 미설정"}
                  </div>
                </button>
              );
            })}
            {visibleItems.length === 0 && (
              <div style={{ padding: 18, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>표시할 공급단가 건이 없습니다.</div>
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
                    </div>
                  </div>
                  <div className="market-actions">
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
                      <span>생산실적 × 1,000원 + 수입실적 × 기준 환율</span>
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
                      <span>공급단가 조정률 (%)</span>
                      <input value={workingAnalysis.supplyPriceAdjustmentRate} onChange={(event) => updateDraft({ supplyPriceAdjustmentRate: event.target.value })} disabled={!isEditing} inputMode="decimal" placeholder="인하 시 음수" style={fieldStyle} />
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
                </div>
                <div className="metric-grid">
                  <Metric label="기준 시장 규모" value={formatCompactWon(calculations.latestYear?.totalKrw)} />
                  <Metric label="5개년 평균 시장 규모" value={formatCompactWon(calculations.averageMarketKrw)} />
                  <Metric label="연평균 성장률" value={formatDecimal(calculations.cagr, 2, "%")} tone={calculations.cagr >= 0 ? "positive" : "warning"} />
                  <Metric label="전국 예상 공급수량" value={formatCount(calculations.marketUnitCount)} subtext={`조정 원가 ${formatWon(calculations.adjustedUnitCost)}`} />
                  <Metric label="참약사 약국 점유율" value={formatDecimal(calculations.pharmacyShareRate, 2, "%")} />
                  <Metric label="침투 예상 가맹약국" value={formatCount(calculations.activeChainPharmacies, "개소")} />
                  <Metric label="연간 예상 소진수량" value={formatCount(calculations.annualDemandUnits)} tone="positive" />
                  <Metric label="침투 약국당 연간 수량" value={formatCount(calculations.annualUnitsPerActivePharmacy)} />
                </div>
              </section>

              <div className="market-result-grid">
                <section style={panelStyle}>
                  <div className="section-title">
                    <div>
                      <strong>배치 소진 및 금융비용</strong>
                      <span>연간 4% 기본값을 분석 조건에서 조정할 수 있습니다.</span>
                    </div>
                  </div>
                  <div className="metric-grid metric-grid-compact">
                    <Metric label="배치 당 공급수량" value={formatCount(calculations.batchQuantity)} />
                    <Metric label="연간 필요 배치" value={formatDecimal(calculations.exactBatches, 2, "배치")} subtext={calculations.requiredBatches === null ? "" : `발주 한도 ${calculations.requiredBatches}배치`} />
                    <Metric label="배치 소진 예상기간" value={formatDecimal(calculations.depletionMonthsPerBatch, 1, "개월")} tone={calculations.depletionMonthsPerBatch > 12 ? "warning" : "default"} />
                    <Metric label="1배치 필요자금" value={formatCompactWon(calculations.batchCapital)} />
                    <Metric label="평균 재고자금" value={formatCompactWon(calculations.averageInventoryCapital)} />
                    <Metric label="연간 금융 기회비용" value={formatWon(calculations.annualFinanceCost)} tone="warning" />
                  </div>
                </section>

                <section style={panelStyle}>
                  <div className="section-title">
                    <div>
                      <strong>조정 시나리오 기댓값</strong>
                      <span>선택한 침투율·공급단가·유통 마진 기준</span>
                    </div>
                  </div>
                  <div className="metric-grid metric-grid-compact">
                    <Metric label="기준 공급 원가" value={formatWon(calculations.baseUnitCost)} />
                    <Metric label="조정 공급 원가" value={formatWon(calculations.adjustedUnitCost)} />
                    <Metric label="참약사 예상 판매가" value={formatWon(calculations.chamyaksaSellingPrice)} subtext={calculations.pricingScenario?.label || "유통 마진 미설정"} />
                    <Metric label="연간 기대 매출" value={formatCompactWon(calculations.expectedRevenue)} />
                    <Metric label="연간 기대 매출총이익" value={formatCompactWon(calculations.expectedGrossProfit)} tone="positive" />
                    <Metric label="금융비용 차감 기댓값" value={formatCompactWon(calculations.expectedProfitAfterFinance)} tone={calculations.expectedProfitAfterFinance >= 0 ? "positive" : "warning"} />
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

      <style jsx>{`
        .market-root { display: grid; gap: 14px; }
        .market-layout { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 14px; align-items: start; }
        .market-item-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; padding: 14px 15px; background: #e8f1fb; }
        .market-actions { display: flex; justify-content: flex-end; gap: 7px; flex-wrap: wrap; }
        .market-input-grid, .market-result-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(340px, .75fr); gap: 14px; }
        .section-title { min-height: 58px; padding: 11px 14px; border-bottom: 1px solid #dbe3ee; display: flex; align-items: center; justify-content: space-between; gap: 12px; box-sizing: border-box; background: #f8fafc; }
        .section-title > div { display: grid; gap: 3px; }
        .section-title strong { color: #0f172a; font-size: 15px; }
        .section-title span { color: #64748b; font-size: 11px; }
        .section-title label { display: flex; align-items: center; gap: 8px; color: #475569; font-size: 11px; font-weight: 800; white-space: nowrap; }
        .market-year-table { display: grid; grid-template-columns: 82px minmax(130px, 1fr) minmax(130px, 1fr) minmax(150px, 1.1fr); gap: 7px; padding: 12px; align-items: center; }
        .market-year-head { color: #475569; font-size: 11px; font-weight: 900; padding: 0 2px 2px; }
        .year-total-cell { position: relative; min-height: 36px; border: 1px solid #dbe3ee; border-radius: 6px; background: #f8fafc; overflow: hidden; display: flex; align-items: center; padding: 0 9px; box-sizing: border-box; }
        .year-total-cell i { position: absolute; left: 0; bottom: 0; height: 3px; background: #2563eb; }
        .year-total-cell span { position: relative; z-index: 1; color: #0f172a; font-size: 12px; font-weight: 900; }
        .condition-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px; padding: 13px; }
        .condition-grid label { min-width: 0; }
        .condition-grid label > span { display: block; margin-bottom: 5px; color: #475569; font-size: 11px; font-weight: 800; }
        .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .metric-grid-compact { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        :global(.market-metric) { min-height: 96px; padding: 13px; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; display: grid; align-content: center; gap: 6px; box-sizing: border-box; }
        :global(.market-metric span) { color: #64748b; font-size: 11px; font-weight: 800; }
        :global(.market-metric strong) { font-size: 17px; line-height: 1.25; overflow-wrap: anywhere; }
        :global(.market-metric small) { color: #64748b; font-size: 10px; line-height: 1.4; }
        @media (max-width: 1250px) {
          .market-input-grid, .market-result-grid { grid-template-columns: 1fr; }
          .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 920px) {
          .market-layout { grid-template-columns: 1fr; }
          .market-layout aside > div:last-child { max-height: 320px !important; }
          .market-item-header { flex-direction: column; }
          .market-actions { justify-content: flex-start; }
        }
        @media (max-width: 640px) {
          .market-year-table { grid-template-columns: 68px minmax(110px, 1fr) minmax(110px, 1fr) minmax(130px, 1fr); overflow-x: auto; }
          .condition-grid, .metric-grid, .metric-grid-compact { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
