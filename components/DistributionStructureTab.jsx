"use client";

import { useMemo, useState } from "react";

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

function formatPercent(value) {
  if (!Number.isFinite(value)) return "-";
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value)}%`;
}

function getItemLabel(item) {
  const ingredientNames = (item.ingredients || []).map((ingredient) => ingredient.name).filter(Boolean).join(", ");
  return ingredientNames || item.manufacturer || "성분 미입력";
}

function getDistribution(item) {
  const source = item?.distributionStructure && typeof item.distributionStructure === "object"
    ? item.distributionStructure
    : {};
  return {
    chamyaksaMarginRate: String(source.chamyaksaMarginRate ?? ""),
    pharmacySellingPrice: String(source.pharmacySellingPrice ?? ""),
    competitors: Array.isArray(source.competitors) ? source.competitors : [],
    updatedAt: String(source.updatedAt || "")
  };
}

function getBaseAmounts(item) {
  const unitPrice = parseNumber(item?.supplyUnitPrice);
  const quantity = parseNumber(item?.quantity);
  const permitFeeRate = parseNumber(item?.permitCompanyFeeRate);
  const vatMultiplier = item?.vatIncluded ? 1.1 : 1;
  const hasPermitFee = item?.category === "OTC" && item?.permitCompanyFee && permitFeeRate !== null;
  const finalUnitCost = unitPrice === null
    ? null
    : unitPrice * (hasPermitFee ? 1.1 * (1 + (permitFeeRate / 100)) : vatMultiplier);

  return {
    unitPrice,
    quantity,
    vatUnitPrice: unitPrice === null || !item?.vatIncluded ? null : unitPrice * 1.1,
    supplyTotal: unitPrice === null || quantity === null ? null : unitPrice * quantity,
    vatTotal: unitPrice === null || quantity === null || !item?.vatIncluded ? null : unitPrice * quantity * 1.1,
    finalUnitCost,
    finalTotal: finalUnitCost === null || quantity === null ? null : finalUnitCost * quantity
  };
}

function createCompetitor() {
  return {
    id: `competitor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date: "",
    productName: "",
    packagingUnit: "",
    salePrice: ""
  };
}

export default function DistributionStructureTab({
  items = [],
  categories = [],
  selectedCategory = "all",
  selectedItemId,
  onSelectedItemChange,
  onUpdateItem,
  syncState
}) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const visibleItems = useMemo(() => {
    const categoryItems = selectedCategory === "all"
      ? items
      : items.filter((item) => item.category === selectedCategory);
    if (!query) return categoryItems;
    return categoryItems.filter((item) => {
      const haystack = [
        item.manufacturer,
        item.packagingUnit,
        ...(item.ingredients || []).flatMap((ingredient) => [ingredient.name, ingredient.content])
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [items, query, selectedCategory]);

  const selectedItem = visibleItems.find((item) => String(item.id) === String(selectedItemId)) || visibleItems[0] || null;
  const distribution = getDistribution(selectedItem);
  const baseAmounts = getBaseAmounts(selectedItem);
  const chamyaksaMarginRate = parseNumber(distribution.chamyaksaMarginRate);
  const marginRateIsValid = chamyaksaMarginRate !== null && chamyaksaMarginRate >= 0 && chamyaksaMarginRate < 100;
  const chamyaksaSellingPrice = marginRateIsValid && baseAmounts.finalUnitCost !== null
    ? baseAmounts.finalUnitCost / (1 - (chamyaksaMarginRate / 100))
    : null;
  const chamyaksaMarginAmount = chamyaksaSellingPrice === null || baseAmounts.finalUnitCost === null
    ? null
    : chamyaksaSellingPrice - baseAmounts.finalUnitCost;
  const pharmacySellingPrice = parseNumber(distribution.pharmacySellingPrice);
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

  const updateCompetitor = (competitorId, patch) => {
    updateDistribution({
      competitors: distribution.competitors.map((competitor) => (
        String(competitor.id) === String(competitorId) ? { ...competitor, ...patch } : competitor
      ))
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
                  <div style={{ marginTop: 5, color: structure.updatedAt ? "#047857" : "#94a3b8", fontSize: 11, fontWeight: 700 }}>
                    {structure.updatedAt ? "유통 구조 설정됨" : "유통 구조 미설정"}
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
                <div style={{ padding: "13px 15px", borderBottom: "1px solid #cbd5e1", background: "#e8f1fb" }}>
                  <div style={{ color: "#0f172a", fontSize: 17, fontWeight: 900 }}>{getItemLabel(selectedItem)}</div>
                  <div style={{ marginTop: 3, color: "#64748b", fontSize: 12 }}>
                    {selectedItem.manufacturer || "제조사 미입력"} · {categoryLabelById[selectedItem.category] || selectedItem.category}
                  </div>
                </div>
                <div className="base-grid">
                  {[
                    ["포장단위", selectedItem.packagingUnit || "-", selectedItem.packagingForm ? `포장형태: ${selectedItem.packagingForm}` : ""],
                    ["수량", selectedItem.quantity || "-", ""],
                    ["배치 당 공급단가", formatWon(baseAmounts.unitPrice), `총 금액: ${formatWon(baseAmounts.supplyTotal)}`],
                    ["배치 당 VAT 포함 가격", formatWon(baseAmounts.vatUnitPrice), `VAT 포함 총금액: ${formatWon(baseAmounts.vatTotal)}`],
                    ["허가사 수수료율", selectedItem.category === "OTC" && selectedItem.permitCompanyFee ? `${selectedItem.permitCompanyFeeRate || "-"}%` : "-", ""],
                    ["수수료 포함 총금액", formatWon(baseAmounts.finalTotal), `유통 원가 기준: ${formatWon(baseAmounts.finalUnitCost)}`]
                  ].map(([label, value, subtext]) => (
                    <div key={label} style={{ padding: 13, borderRight: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
                      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{label}</div>
                      <div style={{ marginTop: 7, color: "#0f172a", fontSize: 16, fontWeight: 900 }}>{value}</div>
                      {subtext && <div style={{ marginTop: 4, color: "#64748b", fontSize: 11 }}>{subtext}</div>}
                    </div>
                  ))}
                </div>
              </section>

              <section style={panelStyle}>
                <div style={{ padding: "12px 15px", borderBottom: "1px solid #cbd5e1", color: "#0f172a", fontSize: 16, fontWeight: 900 }}>
                  판매가 및 마진 설정
                </div>
                <div className="margin-grid">
                  <div>
                    <label style={labelStyle}>참약사 마진율 (%)</label>
                    <input
                      value={distribution.chamyaksaMarginRate}
                      onChange={(event) => updateDistribution({ chamyaksaMarginRate: event.target.value })}
                      inputMode="decimal"
                      placeholder="예: 20"
                      style={inputStyle}
                    />
                    {distribution.chamyaksaMarginRate && !marginRateIsValid && (
                      <div style={{ marginTop: 5, color: "#dc2626", fontSize: 11 }}>0 이상 100 미만의 숫자를 입력해주세요.</div>
                    )}
                  </div>
                  <div className="calculated-cell">
                    <span>참약사 마진금액</span>
                    <strong>{formatWon(chamyaksaMarginAmount)}</strong>
                  </div>
                  <div className="calculated-cell">
                    <span>참약사 판매가</span>
                    <strong>{formatWon(chamyaksaSellingPrice)}</strong>
                    <small>약국 사입 금액</small>
                  </div>
                  <div>
                    <label style={labelStyle}>약국 판매가</label>
                    <input
                      value={distribution.pharmacySellingPrice}
                      onChange={(event) => updateDistribution({ pharmacySellingPrice: event.target.value })}
                      inputMode="numeric"
                      placeholder="예: 15,000"
                      style={inputStyle}
                    />
                  </div>
                  <div className="calculated-cell">
                    <span>약국 마진율</span>
                    <strong style={{ color: pharmacyMarginAmount !== null && pharmacyMarginAmount < 0 ? "#dc2626" : "#0f172a" }}>
                      {formatPercent(pharmacyMarginRate)}
                    </strong>
                  </div>
                  <div className="calculated-cell">
                    <span>약국 마진금액</span>
                    <strong style={{ color: pharmacyMarginAmount !== null && pharmacyMarginAmount < 0 ? "#dc2626" : "#0f172a" }}>
                      {formatWon(pharmacyMarginAmount)}
                    </strong>
                  </div>
                </div>
              </section>

              <section style={panelStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 15px", borderBottom: "1px solid #cbd5e1" }}>
                  <div>
                    <div style={{ color: "#0f172a", fontSize: 16, fontWeight: 900 }}>경쟁제품 비교</div>
                    <div style={{ marginTop: 2, color: "#64748b", fontSize: 12 }}>동일 시장 제품의 판매 조건을 간단히 기록합니다.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateDistribution({ competitors: [...distribution.competitors, createCompetitor()] })}
                    style={secondaryButtonStyle}
                  >
                    + 경쟁제품 추가
                  </button>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: 130 }} />
                      <col />
                      <col style={{ width: 150 }} />
                      <col style={{ width: 150 }} />
                      <col style={{ width: 76 }} />
                    </colgroup>
                    <thead>
                      <tr style={{ background: "#f1f5f9" }}>
                        {["기준일", "경쟁제품명", "포장단위", "판매단가", "관리"].map((header) => (
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
                            <input type="date" value={competitor.date || ""} onChange={(event) => updateCompetitor(competitor.id, { date: event.target.value })} style={inputStyle} />
                          </td>
                          <td style={{ padding: 7, borderBottom: "1px solid #edf2f7" }}>
                            <input value={competitor.productName || ""} onChange={(event) => updateCompetitor(competitor.id, { productName: event.target.value })} placeholder="경쟁제품명" style={inputStyle} />
                          </td>
                          <td style={{ padding: 7, borderBottom: "1px solid #edf2f7" }}>
                            <input value={competitor.packagingUnit || ""} onChange={(event) => updateCompetitor(competitor.id, { packagingUnit: event.target.value })} placeholder="예: 30정" style={inputStyle} />
                          </td>
                          <td style={{ padding: 7, borderBottom: "1px solid #edf2f7" }}>
                            <input value={competitor.salePrice || ""} onChange={(event) => updateCompetitor(competitor.id, { salePrice: event.target.value })} inputMode="numeric" placeholder="예: 20,000원" style={inputStyle} />
                          </td>
                          <td style={{ padding: 7, borderBottom: "1px solid #edf2f7" }}>
                            <button
                              type="button"
                              onClick={() => updateDistribution({ competitors: distribution.competitors.filter((entry) => String(entry.id) !== String(competitor.id)) })}
                              style={{ ...secondaryButtonStyle, color: "#dc2626", borderColor: "#fecaca" }}
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                      {distribution.competitors.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: 20, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
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
        }
        .decision-grid {
          display: grid;
          grid-template-columns: minmax(390px, 0.9fr) minmax(540px, 1.1fr);
          gap: 14px;
          align-items: start;
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
