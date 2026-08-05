"use client";

import { useMemo, useState } from "react";
import SegmentedDateInput from "@/components/SegmentedDateInput";
import { marketDecisionBadgeStyle, marketDecisionLabel } from "@/lib/pms/marketDecision";
import {
  calculateProjectPromotionCost,
  normalizeProjectPromotion,
  projectPromotionReadiness,
  projectPromotionTotalExpectedCost
} from "@/lib/pms/projectPromotion";

const panelStyle = { background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, overflow: "hidden" };
const inputStyle = { width: "100%", minHeight: 36, padding: "7px 9px", border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", color: "#0f172a", fontSize: 14, boxSizing: "border-box" };
const buttonStyle = { minHeight: 34, padding: "7px 11px", border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", color: "#334155", cursor: "pointer", fontSize: 13, fontWeight: 800 };

function itemLabel(item) {
  return (item.ingredients || [])
    .map((ingredient) => [ingredient?.name, ingredient?.content].filter(Boolean).join(" / "))
    .filter(Boolean)
    .join(", ") || "성분 미입력";
}

function formatWon(value) {
  return Number.isFinite(value) ? `${Math.round(value).toLocaleString("ko-KR")}원` : "-";
}

function readinessBadge(ready, label) {
  return (
    <span style={{ padding: "3px 7px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: ready ? "#ecfdf5" : "#f1f5f9", color: ready ? "#047857" : "#64748b", border: `1px solid ${ready ? "#a7f3d0" : "#cbd5e1"}` }}>
      {label} {ready ? "완료" : "미완료"}
    </span>
  );
}

export default function ProjectPromotionTab({ items = [], projects = [], onUpdateItem, onOpenSupply, onOpenDistribution, onOpenMarket, onCreateProjectDraft, onOpenProject, syncState }) {
  const [scope, setScope] = useState("imminent");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(normalizeProjectPromotion());

  const normalizedItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const imminentCount = useMemo(() => normalizedItems.filter((item) => projectPromotionReadiness(item).isImminent).length, [normalizedItems]);
  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return normalizedItems
      .filter((item) => {
        const readiness = projectPromotionReadiness(item);
        if (scope === "imminent" && !readiness.isImminent) return false;
        if (scope === "preparing" && readiness.isImminent) return false;
        if (!keyword) return true;
        return [itemLabel(item), item.manufacturer, item.permitCompany, item.category]
          .some((value) => String(value || "").toLowerCase().includes(keyword));
      })
      .sort((left, right) => {
        const readinessGap = projectPromotionReadiness(right).completedCount - projectPromotionReadiness(left).completedCount;
        if (readinessGap) return readinessGap;
        return String(right.projectPromotion?.updatedAt || right.quoteDate || "").localeCompare(String(left.projectPromotion?.updatedAt || left.quoteDate || ""));
      });
  }, [normalizedItems, query, scope]);

  const startEditing = (item) => {
    setEditingId(item.id);
    setDraft(normalizeProjectPromotion(item.projectPromotion));
  };

  const savePlan = (item) => {
    onUpdateItem?.(item.id, {
      projectPromotion: {
        ...normalizeProjectPromotion(draft),
        updatedAt: new Date().toISOString()
      }
    });
    setEditingId(null);
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section style={{ ...panelStyle, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 23, fontWeight: 900 }}>프로젝트 추진</div>
            <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>공급단가·유통 구조·시장 규모 분석이 준비된 품목의 추진 계획과 예상 비용을 한 번에 확인합니다.</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#047857", fontSize: 12, fontWeight: 800 }}>{syncState?.message || "변경 내용 자동 저장"}</div>
            <div style={{ marginTop: 6, color: "#475569", fontSize: 13 }}>추진 임박 <strong style={{ color: "#0f172a" }}>{imminentCount}건</strong></div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
          {[['imminent', '추진 임박'], ['preparing', '준비 중'], ['all', '전체']].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setScope(id)} style={{ ...buttonStyle, borderColor: scope === id ? "#2563eb" : "#cbd5e1", color: scope === id ? "#1d4ed8" : "#334155", background: scope === id ? "#eff6ff" : "#fff" }}>{label}</button>
          ))}
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="성분명, 제조사 또는 허가사 검색" style={{ ...inputStyle, width: 340, maxWidth: "100%" }} />
        </div>
      </section>

      <section style={{ ...panelStyle, padding: 14 }}>
        <div style={{ marginBottom: 10, color: "#0f172a", fontSize: 14, fontWeight: 900 }}>제품 기획부터 출시·운영까지</div>
        <div className="promotion-lifecycle" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", alignItems: "stretch" }}>
          {[
            ["1", "견적 수집", "공급단가"], ["2", "유통 설계", "판매가·마진"], ["3", "시장 검증", "규모·소진·수익"],
            ["4", "추진 결정", "일정·비용"], ["5", "제품개발", "태스크·이력"], ["6", "계약·생산", "계약서·발주"],
            ["7", "출시·운영", "입고·판매관리"]
          ].map(([step, title, detail], index) => (
            <div key={step} style={{ padding: "11px 9px", background: index < 4 ? "#eff6ff" : "#f8fafc", border: "1px solid #cbd5e1", borderRightWidth: index === 6 ? 1 : 0 }}>
              <div style={{ color: index < 4 ? "#2563eb" : "#64748b", fontSize: 10, fontWeight: 900 }}>STEP {step}</div>
              <div style={{ marginTop: 4, color: "#0f172a", fontSize: 13, fontWeight: 900 }}>{title}</div>
              <div style={{ marginTop: 3, color: "#64748b", fontSize: 10 }}>{detail}</div>
            </div>
          ))}
        </div>
      </section>

      {filteredItems.map((item) => {
        const readiness = projectPromotionReadiness(item);
        const promotion = normalizeProjectPromotion(item.projectPromotion);
        const cost = calculateProjectPromotionCost(item);
        const totalCost = projectPromotionTotalExpectedCost(item);
        const isEditing = String(editingId) === String(item.id);
        const permitCompany = item.category === "OTC" ? (item.permitCompany || "허가사 미입력") : "해당 없음";
        const linkedProject = (Array.isArray(projects) ? projects : []).find((project) => (
          String(project.id) === String(promotion.linkedProjectId)
          || String(project.sourceSupplyItemId || "") === String(item.id)
        ));
        return (
          <section key={item.id} style={{ ...panelStyle, borderLeft: `4px solid ${readiness.isImminent ? "#10b981" : "#94a3b8"}` }}>
            <div style={{ padding: "13px 15px", background: readiness.isImminent ? "#ecfdf5" : "#f8fafc", borderBottom: "1px solid #cbd5e1", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: "#0f172a" }}>{itemLabel(item)}</div>
                <div style={{ marginTop: 4, color: "#475569", fontSize: 12 }}>{item.manufacturer || "제조사 미입력"} · {item.category} · 포장단위 {item.packagingUnit || "미입력"}</div>
              </div>
              <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ padding: "4px 9px", borderRadius: 999, fontSize: 12, fontWeight: 900, background: readiness.isImminent ? "#d1fae5" : "#e2e8f0", color: readiness.isImminent ? "#047857" : "#475569" }}>{readiness.isImminent ? "추진 임박" : `준비 ${readiness.completedCount}/3`}</span>
                <span style={marketDecisionBadgeStyle(item.marketDecisionStatus)}>{marketDecisionLabel(item.marketDecisionStatus)}</span>
                {!isEditing && <button type="button" onClick={() => startEditing(item)} style={buttonStyle}>계획 수정</button>}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", borderBottom: "1px solid #e2e8f0" }} className="promotion-summary-grid">
              {[
                ["제조사", item.manufacturer || "미입력"],
                ["허가사", permitCompany],
                ["예상 출시일", promotion.expectedLaunchDate || "미입력"],
                ["총 예상비용", formatWon(totalCost)]
              ].map(([label, value]) => (
                <div key={label} style={{ padding: 13, minHeight: 74, borderRight: "1px solid #e2e8f0" }}>
                  <div style={{ color: "#64748b", fontSize: 11, fontWeight: 800 }}>{label}</div>
                  <div style={{ marginTop: 7, color: "#0f172a", fontSize: 15, fontWeight: 900, overflowWrap: "anywhere" }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: 14, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {readinessBadge(readiness.supplyReady, "공급단가")}
                {readinessBadge(readiness.distributionReady, "유통 구조")}
                {readinessBadge(readiness.marketReady, "시장 분석")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }} className="promotion-cost-grid">
                <div><div style={{ color: "#64748b", fontSize: 11, fontWeight: 800 }}>최소 주문 기준 생산비</div><strong style={{ display: "block", marginTop: 5 }}>{formatWon(cost.initialProductionCost)}</strong><small style={{ color: "#64748b" }}>최소 {cost.minimumOrderBatches || "-"}배치 · VAT/허가사 수수료 반영</small></div>
                <div><div style={{ color: "#64748b", fontSize: 11, fontWeight: 800 }}>추가 예상비용</div><strong style={{ display: "block", marginTop: 5 }}>{promotion.additionalExpectedCost ? formatWon(Number(String(promotion.additionalExpectedCost).replace(/,/g, ""))) : "-"}</strong></div>
                <div><div style={{ color: "#64748b", fontSize: 11, fontWeight: 800 }}>비용 메모</div><div style={{ marginTop: 5, color: "#334155", whiteSpace: "pre-wrap" }}>{promotion.costMemo || "-"}</div></div>
              </div>

              {isEditing && (
                <div style={{ padding: 12, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 7, display: "grid", gridTemplateColumns: "220px 220px minmax(240px, 1fr) auto", gap: 10, alignItems: "end" }} className="promotion-edit-grid">
                  <label><span style={{ display: "block", marginBottom: 5, color: "#475569", fontSize: 12, fontWeight: 800 }}>예상 출시일</span><SegmentedDateInput value={draft.expectedLaunchDate} onChange={(value) => setDraft((previous) => ({ ...previous, expectedLaunchDate: value }))} /></label>
                  <label><span style={{ display: "block", marginBottom: 5, color: "#475569", fontSize: 12, fontWeight: 800 }}>추가 예상비용(원)</span><input value={draft.additionalExpectedCost} onChange={(event) => setDraft((previous) => ({ ...previous, additionalExpectedCost: event.target.value }))} inputMode="numeric" placeholder="예: 5,000,000" style={inputStyle} /></label>
                  <label><span style={{ display: "block", marginBottom: 5, color: "#475569", fontSize: 12, fontWeight: 800 }}>비용 메모</span><input value={draft.costMemo} onChange={(event) => setDraft((previous) => ({ ...previous, costMemo: event.target.value }))} placeholder="예: 디자인·인허가·초도 마케팅 비용" style={inputStyle} /></label>
                  <div style={{ display: "flex", gap: 7 }}><button type="button" onClick={() => savePlan(item)} style={{ ...buttonStyle, background: "#0f172a", borderColor: "#0f172a", color: "#fff" }}>저장</button><button type="button" onClick={() => setEditingId(null)} style={buttonStyle}>취소</button></div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => onOpenSupply?.(item.id)} style={buttonStyle}>공급단가 보기</button>
                <button type="button" onClick={() => onOpenDistribution?.(item.id)} style={buttonStyle}>유통 구조 보기</button>
                <button type="button" onClick={() => onOpenMarket?.(item.id)} style={buttonStyle}>시장 규모 분석</button>
                {linkedProject ? (
                  <button type="button" onClick={() => onOpenProject?.(linkedProject.id)} style={{ ...buttonStyle, borderColor: "#10b981", color: "#047857", background: "#ecfdf5" }}>제품개발 프로젝트 보기</button>
                ) : (
                  <button
                    type="button"
                    disabled={!readiness.isImminent}
                    onClick={() => onCreateProjectDraft?.(item)}
                    title={readiness.isImminent ? "현재 검토 자료를 새 프로젝트 기안에 연결합니다." : "공급단가·유통 구조·시장 분석을 모두 완료한 뒤 전환할 수 있습니다."}
                    style={{ ...buttonStyle, borderColor: readiness.isImminent ? "#2563eb" : "#cbd5e1", color: readiness.isImminent ? "#fff" : "#94a3b8", background: readiness.isImminent ? "#2563eb" : "#f8fafc", cursor: readiness.isImminent ? "pointer" : "not-allowed" }}
                  >
                    제품개발 프로젝트 기안
                  </button>
                )}
              </div>
            </div>
          </section>
        );
      })}

      {filteredItems.length === 0 && <div style={{ ...panelStyle, padding: 28, textAlign: "center", color: "#64748b" }}>조건에 맞는 프로젝트 추진 대상이 없습니다.</div>}

      <style jsx>{`
        @media (max-width: 1100px) {
          .promotion-lifecycle { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 6px; }
          .promotion-summary-grid, .promotion-cost-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .promotion-edit-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 720px) {
          .promotion-lifecycle { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .promotion-summary-grid, .promotion-cost-grid, .promotion-edit-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
