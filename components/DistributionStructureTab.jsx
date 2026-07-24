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
  const finalUnitCost = unitPrice === null ? null : unitPrice * 1.1;

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
    packagingUnit: "",
    salePrice: "",
    priceTiers: [createPriceTier()]
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
  const [editingItemId, setEditingItemId] = useState(null);
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
  const isEditing = selectedItem && String(editingItemId) === String(selectedItem.id);
  const distribution = getDistribution(selectedItem);
  const baseAmounts = getBaseAmounts(selectedItem);
  const chamyaksaMarginRate = parseNumber(distribution.chamyaksaMarginRate);
  const marginRateIsValid = chamyaksaMarginRate !== null && chamyaksaMarginRate >= 0;
  const chamyaksaSellingPrice = marginRateIsValid && baseAmounts.finalUnitCost !== null
    ? baseAmounts.finalUnitCost * (1 + (chamyaksaMarginRate / 100))
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "13px 15px", borderBottom: "1px solid #cbd5e1", background: "#e8f1fb" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "#0f172a", fontSize: 17, fontWeight: 900 }}>{getItemLabel(selectedItem)}</div>
                    <div style={{ marginTop: 3, color: "#64748b", fontSize: 12 }}>
                      {selectedItem.manufacturer || "제조사 미입력"} · {categoryLabelById[selectedItem.category] || selectedItem.category}
                    </div>
                  </div>
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
                <div className="base-grid">
                  {[
                    ["포장단위", selectedItem.packagingUnit || "-", selectedItem.packagingForm ? `포장형태: ${selectedItem.packagingForm}` : ""],
                    ["수량", selectedItem.quantity || "-", ""],
                    ["배치 당 공급단가", formatWon(baseAmounts.unitPrice), `총 금액: ${formatWon(baseAmounts.supplyTotal)}`],
                    ["배치 당 VAT 포함 가격", formatWon(baseAmounts.vatUnitPrice), `VAT 포함 총금액: ${formatWon(baseAmounts.vatTotal)}`],
                    ["허가사 수수료", selectedItem.category === "OTC" && selectedItem.permitCompanyFee ? "포함" : "-", ""],
                    ["VAT 포함 유통 원가", formatWon(baseAmounts.finalTotal), `개당: ${formatWon(baseAmounts.finalUnitCost)}`]
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
                <div style={{ padding: "12px 15px", borderBottom: "1px solid #cbd5e1" }}>
                  <div style={{ color: "#0f172a", fontSize: 16, fontWeight: 900 }}>판매가 및 마진 설정</div>
                  <div style={{ marginTop: 4, color: "#475569", fontSize: 12, lineHeight: 1.5 }}>
                    모든 금액은 VAT 포함 기준입니다. 참약사 마진은 VAT 포함 유통 원가 {formatWon(baseAmounts.finalUnitCost)}에 입력한 비율을 가산합니다.
                  </div>
                </div>
                <div className="margin-grid">
                  <div>
                    <label style={labelStyle}>참약사 마진 가산율 (%)</label>
                    {isEditing ? (
                      <input
                        value={distribution.chamyaksaMarginRate}
                        onChange={(event) => updateDistribution({ chamyaksaMarginRate: event.target.value })}
                        inputMode="decimal"
                        placeholder="예: 20"
                        style={inputStyle}
                      />
                    ) : (
                      <div className="readonly-value">{distribution.chamyaksaMarginRate ? `${distribution.chamyaksaMarginRate}%` : "-"}</div>
                    )}
                    {isEditing && distribution.chamyaksaMarginRate && !marginRateIsValid && (
                      <div style={{ marginTop: 5, color: "#dc2626", fontSize: 11 }}>0 이상의 숫자를 입력해주세요.</div>
                    )}
                  </div>
                  <div className="calculated-cell">
                    <span>참약사 마진금액 (VAT 포함)</span>
                    <strong>{formatWon(chamyaksaMarginAmount)}</strong>
                  </div>
                  <div className="calculated-cell">
                    <span>참약사 판매가 (VAT 포함)</span>
                    <strong>{formatWon(chamyaksaSellingPrice)}</strong>
                    <small>약국 사입 금액</small>
                  </div>
                  <div>
                    <label style={labelStyle}>약국 판매가 (VAT 포함)</label>
                    {isEditing ? (
                      <input
                        value={distribution.pharmacySellingPrice}
                        onChange={(event) => updateDistribution({ pharmacySellingPrice: event.target.value })}
                        inputMode="numeric"
                        placeholder="예: 15,000"
                        style={inputStyle}
                      />
                    ) : (
                      <div className="readonly-value">{formatWon(pharmacySellingPrice)}</div>
                    )}
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
                </div>
              </section>

              <section style={panelStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 15px", borderBottom: "1px solid #cbd5e1" }}>
                  <div>
                    <div style={{ color: "#0f172a", fontSize: 16, fontWeight: 900 }}>경쟁제품 비교</div>
                    <div style={{ marginTop: 2, color: "#64748b", fontSize: 12 }}>동일 시장 제품의 판매 조건을 간단히 기록합니다.</div>
                  </div>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => updateDistribution({ competitors: [...distribution.competitors, createCompetitor()] })}
                      style={secondaryButtonStyle}
                    >
                      + 경쟁제품 추가
                    </button>
                  )}
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: 790, borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: 130 }} />
                      <col />
                      <col style={{ width: 150 }} />
                      <col style={{ width: 260 }} />
                      {isEditing && <col style={{ width: 76 }} />}
                    </colgroup>
                    <thead>
                      <tr style={{ background: "#f1f5f9" }}>
                        {["기준일", "경쟁제품명", "포장단위", "판매단가", ...(isEditing ? ["관리"] : [])].map((header) => (
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
                              <input type="date" value={competitor.date || ""} onChange={(event) => updateCompetitor(competitor.id, { date: event.target.value })} style={inputStyle} />
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
                            <td colSpan={isEditing ? 5 : 4} style={{ padding: 20, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
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
        .readonly-value {
          min-height: 38px;
          padding: 8px 10px;
          border: 1px solid #dbe3ee;
          border-radius: 7px;
          background: #f8fafc;
          color: #0f172a;
          font-size: 14px;
          font-weight: 800;
          box-sizing: border-box;
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
