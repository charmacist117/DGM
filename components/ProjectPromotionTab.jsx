"use client";

import { useEffect, useMemo, useState } from "react";
import SegmentedDateInput from "@/components/SegmentedDateInput";
import IngredientAmountTitle, { formatIngredientAmountLabel } from "@/components/IngredientAmountTitle";
import { calculateMarketAnalysis, calculateSellingPriceFromMarginRate } from "@/lib/pms/marketAnalysis";
import { marketDecisionBadgeStyle, marketDecisionLabel } from "@/lib/pms/marketDecision";
import {
  PROMOTION_PROGRESS_OPTIONS,
  calculateProjectPromotionCost,
  normalizeProjectPromotion,
  projectPromotionReadiness,
  projectPromotionTotalExpectedCost,
  promotionFinalDecisionLabel,
  promotionProgressBadgeStyle,
  promotionProgressLabel
} from "@/lib/pms/projectPromotion";
import {
  MISSING_PERMIT_COMPANY_FILTER,
  matchesPermitCompanyFilter,
  permitCompanyFilterOptions
} from "@/lib/pms/permitCompanyFilter";

const panelStyle = { background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, overflow: "hidden" };
const inputStyle = { width: "100%", minHeight: 36, padding: "7px 9px", border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", color: "#0f172a", fontSize: 14, boxSizing: "border-box" };
const buttonStyle = { minHeight: 34, padding: "7px 11px", border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", color: "#334155", cursor: "pointer", fontSize: 13, fontWeight: 800 };

function numberValue(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function itemLabel(item) {
  return formatIngredientAmountLabel(item, "성분 미입력");
}

function formatWon(value) {
  return Number.isFinite(value) ? `${Math.round(value).toLocaleString("ko-KR")}원` : "-";
}

function formatCompactWon(value) {
  if (!Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}억원`;
  if (Math.abs(value) >= 10_000) return `${(value / 10_000).toFixed(1)}만원`;
  return formatWon(value);
}

function readinessBadge(ready, label) {
  return <span style={{ padding: "3px 7px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: ready ? "#ecfdf5" : "#f1f5f9", color: ready ? "#047857" : "#64748b", border: `1px solid ${ready ? "#a7f3d0" : "#cbd5e1"}` }}>{label} {ready ? "완료" : "미완료"}</span>;
}

function SummaryCell({ label, value, subtext }) {
  return <div style={{ padding: 12, minHeight: 70, borderRight: "1px solid #e2e8f0" }}><div style={{ color: "#64748b", fontSize: 11, fontWeight: 800 }}>{label}</div><strong style={{ display: "block", marginTop: 6, color: "#0f172a", fontSize: 15, overflowWrap: "anywhere" }}>{value}</strong>{subtext && <small style={{ display: "block", marginTop: 3, color: "#64748b" }}>{subtext}</small>}</div>;
}

export default function ProjectPromotionTab({ items = [], projects = [], marketAnalysisDefaults = {}, selectedItemId: controlledSelectedItemId = null, onSelectedItemChange, onUpdateItem, onLinkProject, onOpenSupply, onOpenDistribution, onOpenMarket, onCreateProjectDraft, onOpenProject, syncState, isAdmin = false }) {
  const [progressFilter, setProgressFilter] = useState("all");
  const [permitCompanyFilter, setPermitCompanyFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(normalizeProjectPromotion());
  const [linkingProject, setLinkingProject] = useState(false);
  const [projectLinkDraftId, setProjectLinkDraftId] = useState("");

  const eligibleItems = useMemo(() => (Array.isArray(items) ? items : []).filter((item) => (
    item.marketDecisionStatus === "proceed" && projectPromotionReadiness(item).isImminent
  )), [items]);
  const counts = useMemo(() => Object.fromEntries(PROMOTION_PROGRESS_OPTIONS.map((option) => [option.value, eligibleItems.filter((item) => normalizeProjectPromotion(item.projectPromotion).progressDecision === option.value).length])), [eligibleItems]);
  const permitCompanyOptions = useMemo(() => permitCompanyFilterOptions(eligibleItems), [eligibleItems]);
  useEffect(() => {
    if (permitCompanyFilter === "all" || permitCompanyFilter === MISSING_PERMIT_COMPANY_FILTER) return;
    if (!permitCompanyOptions.includes(permitCompanyFilter)) setPermitCompanyFilter("all");
  }, [permitCompanyFilter, permitCompanyOptions]);
  const visibleItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return eligibleItems.filter((item) => {
      const promotion = normalizeProjectPromotion(item.projectPromotion);
      if (progressFilter !== "all" && promotion.progressDecision !== progressFilter) return false;
      if (!matchesPermitCompanyFilter(item, permitCompanyFilter)) return false;
      return !keyword || [itemLabel(item), item.manufacturer, item.permitCompany, item.category].some((value) => String(value || "").toLowerCase().includes(keyword));
    }).sort((left, right) => String(right.projectPromotion?.updatedAt || right.quoteDate || "").localeCompare(String(left.projectPromotion?.updatedAt || left.quoteDate || "")));
  }, [eligibleItems, permitCompanyFilter, progressFilter, query]);
  const selectedItem = visibleItems.find((item) => String(item.id) === String(selectedItemId)) || visibleItems[0] || null;

  useEffect(() => {
    if (controlledSelectedItemId !== null && controlledSelectedItemId !== undefined) {
      setSelectedItemId(controlledSelectedItemId);
    }
  }, [controlledSelectedItemId]);

  useEffect(() => {
    if (selectedItem && String(selectedItem.id) !== String(selectedItemId)) {
      setSelectedItemId(selectedItem.id);
      onSelectedItemChange?.(selectedItem.id);
    }
    if (!selectedItem) setSelectedItemId(null);
  }, [selectedItem, selectedItemId]);

  useEffect(() => {
    setEditing(false);
    setDraft(normalizeProjectPromotion(selectedItem?.projectPromotion));
  }, [selectedItem?.id]);

  const savePlan = () => {
    if (!selectedItem) return;
    const now = new Date().toISOString();
    const normalized = normalizeProjectPromotion(draft);
    const shouldLogFollowUp = ["supplement", "hold", "stop"].includes(normalized.progressDecision);
    const followUpNote = String(draft.followUpNote || "").trim();
    if (shouldLogFollowUp && !followUpNote) {
      window.alert(normalized.progressDecision === "supplement"
        ? "내용 보완 과정에서 오고 간 협의·요청·회신 내용을 입력해주세요."
        : "후속 진행 F/U 내용을 입력해주세요.");
      return;
    }
    const followUps = shouldLogFollowUp
      ? [...normalized.followUps, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, status: normalized.progressDecision, note: followUpNote, createdAt: now }]
      : normalized.followUps;
    onUpdateItem?.(selectedItem.id, { projectPromotion: {
      ...normalized,
      finalDecision: normalized.progressDecision === "executive_report" ? normalized.finalDecision : "",
      finalDecisionAt: normalized.progressDecision === "executive_report" ? normalized.finalDecisionAt : "",
      followUps,
      followUpNote: "",
      updatedAt: now
    } });
    setEditing(false);
  };

  const saveFinalDecision = (finalDecision) => {
    if (!selectedItem || promotion.progressDecision !== "executive_report") return;
    const now = new Date().toISOString();
    onUpdateItem?.(selectedItem.id, { projectPromotion: { ...promotion, finalDecision, finalDecisionAt: now, updatedAt: now } });
  };

  const deletePlan = () => {
    if (!isAdmin || !selectedItem) return;
    if (!window.confirm("이 품목의 추진 계획 설정과 F/U 이력을 모두 삭제하시겠습니까?")) return;
    onUpdateItem?.(selectedItem.id, { projectPromotion: normalizeProjectPromotion() });
    setEditing(false);
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date);
  };

  const promotion = normalizeProjectPromotion(selectedItem?.projectPromotion);
  const readiness = selectedItem ? projectPromotionReadiness(selectedItem) : null;
  const cost = selectedItem ? calculateProjectPromotionCost(selectedItem) : {};
  const totalCost = selectedItem ? projectPromotionTotalExpectedCost(selectedItem) : null;
  const market = selectedItem ? calculateMarketAnalysis(selectedItem, selectedItem.marketSizeAnalysis, marketAnalysisDefaults) : null;
  const scenarios = selectedItem?.distributionStructure?.pricingScenarios || [];
  const linkedProject = selectedItem ? (projects || []).find((project) => String(project.id) === String(promotion.linkedProjectId) || String(project.sourceSupplyItemId || "") === String(selectedItem.id)) : null;
  const projectConnectionById = new Map();
  (items || []).forEach((item) => {
    const linkedId = normalizeProjectPromotion(item.projectPromotion).linkedProjectId;
    if (linkedId) projectConnectionById.set(String(linkedId), item.id);
  });
  (projects || []).forEach((project) => {
    if (project.sourceSupplyItemId) projectConnectionById.set(String(project.id), project.sourceSupplyItemId);
  });
  const selectableProjects = (projects || []).filter((project) => {
    const connectedItemId = projectConnectionById.get(String(project.id));
    return !connectedItemId || String(connectedItemId) === String(selectedItem?.id);
  });

  useEffect(() => {
    setLinkingProject(false);
    setProjectLinkDraftId(linkedProject ? String(linkedProject.id) : "");
  }, [selectedItem?.id, linkedProject?.id]);

  const saveProjectLink = () => {
    if (!selectedItem || !projectLinkDraftId) {
      window.alert("연결할 기존 프로젝트를 선택해주세요.");
      return;
    }
    onLinkProject?.(selectedItem.id, projectLinkDraftId);
    setLinkingProject(false);
  };

  const clearProjectLink = () => {
    if (!selectedItem || !linkedProject) return;
    if (!window.confirm(`‘${linkedProject.name}’ 프로젝트 연결을 해제하시겠습니까?`)) return;
    onLinkProject?.(selectedItem.id, "");
    setProjectLinkDraftId("");
    setLinkingProject(false);
  };

  return <div style={{ display: "grid", gap: 14 }}>
    <section style={{ ...panelStyle, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}><div><div style={{ fontSize: 23, fontWeight: 900 }}>프로젝트 추진</div><div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>시장 검토결과가 ‘진행 추진’이고 선행 분석이 완료된 품목만 관리합니다.</div></div><div style={{ textAlign: "right", color: "#047857", fontSize: 12, fontWeight: 800 }}>{syncState?.message || "변경 내용 자동 저장"}<div style={{ marginTop: 6, color: "#475569" }}>추진 대상 {eligibleItems.length}건</div></div></div>
    </section>

    <section style={{ ...panelStyle, padding: 12 }}><div className="promotion-lifecycle" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>{[["견적 수집", "공급단가"], ["유통 설계", "판매가·마진"], ["시장 검증", "규모·수익"], ["추진 결정", "일정·비용"], ["제품개발", "태스크·이력"], ["계약·생산", "계약서·발주"], ["출시·운영", "입고·판매"]].map(([title, detail], index) => <div key={title} style={{ padding: 10, background: index < 4 ? "#eff6ff" : "#f8fafc", border: "1px solid #cbd5e1", borderRightWidth: index === 6 ? 1 : 0 }}><div style={{ color: index < 4 ? "#2563eb" : "#64748b", fontSize: 10, fontWeight: 900 }}>STEP {index + 1}</div><div style={{ marginTop: 4, fontSize: 13, fontWeight: 900 }}>{title}</div><div style={{ marginTop: 2, color: "#64748b", fontSize: 10 }}>{detail}</div></div>)}</div></section>

    <div className="promotion-page-layout" style={{ display: "grid", gridTemplateColumns: "290px minmax(0, 1fr)", gap: 14, alignItems: "start" }}>
      <aside style={{ ...panelStyle, padding: 10, position: "sticky", top: 88 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <select value={progressFilter} onChange={(event) => setProgressFilter(event.target.value)} style={inputStyle}><option value="all">전체 진행 상태 ({eligibleItems.length})</option>{PROMOTION_PROGRESS_OPTIONS.map((option) => <option key={option.value || "undecided"} value={option.value}>{option.label} ({counts[option.value] || 0})</option>)}</select>
          <select value={permitCompanyFilter} onChange={(event) => setPermitCompanyFilter(event.target.value)} style={inputStyle} aria-label="허가사 필터"><option value="all">전체 허가사</option>{permitCompanyOptions.map((permitCompany) => <option key={permitCompany} value={permitCompany}>{permitCompany}</option>)}<option value={MISSING_PERMIT_COMPANY_FILTER}>허가사 미입력</option></select>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="성분명, 제조사, 허가사 검색" style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 7, marginTop: 10, maxHeight: "calc(100vh - 250px)", overflowY: "auto", overflowX: "hidden" }}>{visibleItems.map((item) => { const active = String(item.id) === String(selectedItem?.id); const itemPromotion = normalizeProjectPromotion(item.projectPromotion); const fullLabel = itemLabel(item); return <button key={item.id} type="button" onClick={() => setSelectedItemId(item.id)} style={{ width: "100%", minWidth: 0, maxWidth: "100%", overflow: "hidden", padding: 10, textAlign: "left", borderRadius: 7, border: `1px solid ${active ? "#2563eb" : "#cbd5e1"}`, background: active ? "#eff6ff" : "#fff", cursor: "pointer" }}><IngredientAmountTitle label={fullLabel} maxFontSize={13} minFontSize={11} /><div style={{ minWidth: 0, marginTop: 4, color: "#64748b", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.manufacturer || "제조사 미입력"} · {item.permitCompany || "허가사 미입력"}</div><div style={{ marginTop: 6 }}><span style={promotionProgressBadgeStyle(itemPromotion.progressDecision)}>{promotionProgressLabel(itemPromotion.progressDecision)}</span></div></button>; })}{visibleItems.length === 0 && <div style={{ padding: 18, color: "#94a3b8", textAlign: "center", fontSize: 12 }}>조건에 맞는 추진 품목이 없습니다.</div>}</div>
      </aside>

      <main style={{ minWidth: 0 }}>{!selectedItem ? <section style={{ ...panelStyle, padding: 32, textAlign: "center", color: "#64748b" }}>시장 검토결과가 ‘진행 추진’인 품목이 없습니다.</section> : <div style={{ display: "grid", gap: 12 }}>
        <section style={panelStyle}><div style={{ padding: 14, background: "#ecfdf5", borderBottom: "1px solid #cbd5e1", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div style={{ minWidth: 0, flex: "1 1 440px" }}><IngredientAmountTitle item={selectedItem} fallback="성분 미입력" maxFontSize={18} minFontSize={12} /><div style={{ marginTop: 4, color: "#475569", fontSize: 12 }}>{selectedItem.manufacturer || "제조사 미입력"} · {selectedItem.category} · 허가사 {selectedItem.category === "OTC" ? (selectedItem.permitCompany || "미입력") : "해당 없음"}</div></div><div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}><span style={marketDecisionBadgeStyle(selectedItem.marketDecisionStatus)}>시장 검토 · {marketDecisionLabel(selectedItem.marketDecisionStatus)}</span><span style={promotionProgressBadgeStyle(promotion.progressDecision)}>최종 진행 · {promotionProgressLabel(promotion.progressDecision)}</span><button type="button" onClick={() => { setDraft(promotion); setEditing(true); }} style={buttonStyle}>추진 계획 설정</button>{isAdmin && promotion.updatedAt && <button type="button" onClick={deletePlan} style={{ ...buttonStyle, borderColor: "#fca5a5", color: "#dc2626", background: "#fff" }}>추진 계획 삭제</button>}</div></div>
          <div className="promotion-summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}><SummaryCell label="제조사" value={selectedItem.manufacturer || "미입력"} /><SummaryCell label="허가사" value={selectedItem.category === "OTC" ? (selectedItem.permitCompany || "미입력") : "해당 없음"} /><SummaryCell label="예상 출시일" value={promotion.expectedLaunchDate || "미입력"} /><SummaryCell label="총 예상비용" value={formatWon(totalCost)} /></div>
        </section>

        {editing && <section style={{ ...panelStyle, padding: 13, background: "#f8fafc" }}><div className="promotion-edit-grid" style={{ display: "grid", gridTemplateColumns: "190px 210px 210px minmax(220px, 1fr) auto", gap: 9, alignItems: "end" }}><label><b style={{ display: "block", marginBottom: 5, fontSize: 12 }}>최종 진행</b><select value={draft.progressDecision} onChange={(event) => setDraft((prev) => ({ ...prev, progressDecision: event.target.value, followUpNote: "" }))} style={inputStyle}>{PROMOTION_PROGRESS_OPTIONS.map((option) => <option key={option.value || "undecided"} value={option.value}>{option.label}</option>)}</select></label><label><b style={{ display: "block", marginBottom: 5, fontSize: 12 }}>예상 출시일</b><SegmentedDateInput value={draft.expectedLaunchDate} onChange={(value) => setDraft((prev) => ({ ...prev, expectedLaunchDate: value }))} /></label><label><b style={{ display: "block", marginBottom: 5, fontSize: 12 }}>추가 예상비용(원)</b><input value={draft.additionalExpectedCost} onChange={(event) => setDraft((prev) => ({ ...prev, additionalExpectedCost: event.target.value }))} style={inputStyle} inputMode="numeric" /></label><label><b style={{ display: "block", marginBottom: 5, fontSize: 12 }}>비용 메모</b><input value={draft.costMemo} onChange={(event) => setDraft((prev) => ({ ...prev, costMemo: event.target.value }))} style={inputStyle} /></label><div style={{ display: "flex", gap: 6 }}><button type="button" onClick={savePlan} style={{ ...buttonStyle, background: "#0f172a", color: "#fff" }}>저장</button><button type="button" onClick={() => setEditing(false)} style={buttonStyle}>취소</button></div></div>{["supplement", "hold", "stop"].includes(draft.progressDecision) && <label style={{ display: "block", marginTop: 10 }}><b style={{ display: "block", marginBottom: 5, fontSize: 12 }}>{draft.progressDecision === "supplement" ? "내용 보완 협의·요청·회신 기록 *" : "후속 진행 F/U 내용 *"}</b><textarea value={draft.followUpNote || ""} onChange={(event) => setDraft((prev) => ({ ...prev, followUpNote: event.target.value }))} placeholder={draft.progressDecision === "supplement" ? "보완 요청 내용과 주고받은 답변, 다음 확인 일정을 입력하세요." : "후속 확인사항, 보류 또는 중단 사유를 입력하세요."} style={{ ...inputStyle, minHeight: 86, resize: "vertical" }} /></label>}</section>}

        {promotion.progressDecision === "executive_report" && <section style={{ ...panelStyle, padding: 13, background: "#eff6ff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}><div><b style={{ fontSize: 14 }}>경영진 보고 후 최종 결정</b><div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>현재 결정: {promotionFinalDecisionLabel(promotion.finalDecision)}{promotion.finalDecisionAt ? ` · ${formatDateTime(promotion.finalDecisionAt)}` : ""}</div></div><div style={{ display: "flex", gap: 7 }}><button type="button" onClick={() => saveFinalDecision("proceed")} style={{ ...buttonStyle, borderColor: "#16a34a", background: promotion.finalDecision === "proceed" ? "#16a34a" : "#fff", color: promotion.finalDecision === "proceed" ? "#fff" : "#15803d" }}>최종 진행</button><button type="button" onClick={() => saveFinalDecision("hold")} style={{ ...buttonStyle, borderColor: "#f59e0b", background: promotion.finalDecision === "hold" ? "#f59e0b" : "#fff", color: promotion.finalDecision === "hold" ? "#fff" : "#b45309" }}>보류</button></div></section>}

        {promotion.followUps.length > 0 && <section style={panelStyle}><div style={{ padding: "10px 13px", background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", fontWeight: 900 }}>후속 진행 F/U 이력</div><div style={{ display: "grid" }}>{[...promotion.followUps].reverse().map((entry) => <div key={entry.id || `${entry.createdAt}-${entry.status}`} style={{ display: "grid", gridTemplateColumns: "110px 170px minmax(0, 1fr)", gap: 12, padding: "10px 13px", borderBottom: "1px solid #e2e8f0", alignItems: "start" }}><span style={promotionProgressBadgeStyle(entry.status)}>{promotionProgressLabel(entry.status)}</span><time style={{ color: "#64748b", fontSize: 12 }}>{formatDateTime(entry.createdAt)}</time><div style={{ color: "#334155", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{entry.note || "별도 F/U 내용 없음"}</div></div>)}</div></section>}

        <section style={panelStyle}><div style={{ padding: "10px 13px", background: "#dbeafe", borderBottom: "1px solid #bfdbfe", fontWeight: 900 }}>공급단가</div><div className="promotion-data-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}><SummaryCell label="배치 당 공급단가" value={formatWon(numberValue(selectedItem.supplyUnitPrice))} /><SummaryCell label="배치 당 포장단위 개수" value={selectedItem.quantity ? `${Number(selectedItem.quantity).toLocaleString("ko-KR")}개` : "-"} /><SummaryCell label="최소 주문 배치" value={`${cost.minimumOrderBatches || "-"}배치`} /><SummaryCell label="최소 주문 기준 생산비" value={formatWon(cost.initialProductionCost)} subtext="VAT·허가사 수수료 반영" /></div><div style={{ padding: "9px 13px", borderTop: "1px solid #e2e8f0" }}><button onClick={() => onOpenSupply?.(selectedItem.id)} style={buttonStyle}>공급단가 원문 보기</button></div></section>

        <section style={panelStyle}><div style={{ padding: "10px 13px", background: "#dbeafe", borderBottom: "1px solid #bfdbfe", fontWeight: 900 }}>유통 구조 설정</div><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><thead><tr>{["가격대", "적용 물량", "참약사 마진율", "참약사 판매가", "약국 판매가"].map((header) => <th key={header} style={{ padding: 9, background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>{header}</th>)}</tr></thead><tbody>{scenarios.map((scenario) => <tr key={scenario.id}><td style={{ padding: 9, borderBottom: "1px solid #e2e8f0" }}>{scenario.label || "기본"}</td><td style={{ padding: 9, borderBottom: "1px solid #e2e8f0" }}>{scenario.minimumQuantity || "기본"}</td><td style={{ padding: 9, borderBottom: "1px solid #e2e8f0" }}>{scenario.chamyaksaMarginRate ? `${scenario.chamyaksaMarginRate}%` : "-"}</td><td style={{ padding: 9, borderBottom: "1px solid #e2e8f0", fontWeight: 800 }}>{formatWon(calculateSellingPriceFromMarginRate(cost.finalUnitCost, scenario.chamyaksaMarginRate))}</td><td style={{ padding: 9, borderBottom: "1px solid #e2e8f0" }}>{scenario.pharmacySellingPrice ? `${Number(String(scenario.pharmacySellingPrice).replace(/,/g, "")).toLocaleString("ko-KR")}원` : "-"}</td></tr>)}{scenarios.length === 0 && <tr><td colSpan={5} style={{ padding: 18, textAlign: "center", color: "#94a3b8" }}>등록된 가격대가 없습니다.</td></tr>}</tbody></table></div><div style={{ padding: "9px 13px" }}><button onClick={() => onOpenDistribution?.(selectedItem.id)} style={buttonStyle}>유통 구조 원문 보기</button></div></section>

        <section style={panelStyle}><div style={{ padding: "10px 13px", background: "#dbeafe", borderBottom: "1px solid #bfdbfe", fontWeight: 900 }}>시장 규모 분석</div><div className="promotion-data-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}><SummaryCell label="기준 시장 규모" value={formatCompactWon(market?.latestYear?.totalKrw)} /><SummaryCell label="연평균 성장률" value={Number.isFinite(market?.cagr5Year) ? `${market.cagr5Year.toFixed(2)}%` : "-"} /><SummaryCell label="연간 예상 소진수량" value={Number.isFinite(market?.annualDemandUnits) ? `${Math.round(market.annualDemandUnits).toLocaleString("ko-KR")}개` : "-"} /><SummaryCell label="연간 필요 배치" value={Number.isFinite(market?.exactBatches) ? `${market.exactBatches.toFixed(2)}배치` : "-"} /><SummaryCell label="연간 금융 기회비용" value={formatWon(market?.annualFinanceCost)} /><SummaryCell label="참약사 예상 판매가" value={formatWon(market?.chamyaksaSellingPrice)} /><SummaryCell label="연간 기대 매출총이익" value={formatCompactWon(market?.expectedGrossProfit)} /><SummaryCell label="금융비용 차감 기댓값" value={formatCompactWon(market?.expectedProfitAfterFinance)} /></div><div style={{ padding: "9px 13px", borderTop: "1px solid #e2e8f0" }}><button onClick={() => onOpenMarket?.(selectedItem.id)} style={buttonStyle}>시장 분석 원문 보기</button></div></section>

        <section style={{ ...panelStyle, padding: 12 }}>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>{readinessBadge(readiness?.supplyReady, "공급단가")}{readinessBadge(readiness?.distributionReady, "유통 구조")}{readinessBadge(readiness?.marketReady, "시장 분석")}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {linkedProject ? <>
              <button onClick={() => onOpenProject?.(linkedProject.id)} style={{ ...buttonStyle, borderColor: "#10b981", color: "#047857", background: "#ecfdf5" }}>연결 프로젝트 보기</button>
              <button onClick={() => { setProjectLinkDraftId(String(linkedProject.id)); setLinkingProject(true); }} style={buttonStyle}>연결 변경</button>
              <button onClick={clearProjectLink} style={{ ...buttonStyle, borderColor: "#fca5a5", color: "#dc2626" }}>연결 해제</button>
            </> : <>
              <button onClick={() => onCreateProjectDraft?.(selectedItem)} style={{ ...buttonStyle, background: "#2563eb", borderColor: "#2563eb", color: "#fff" }}>제품개발 프로젝트 기안</button>
              <button onClick={() => { setProjectLinkDraftId(""); setLinkingProject(true); }} style={buttonStyle}>기존 프로젝트 연결</button>
            </>}
          </div>
          {linkingProject && <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) auto", gap: 8, alignItems: "end", marginTop: 10, padding: 10, border: "1px solid #bfdbfe", borderRadius: 7, background: "#eff6ff" }}>
            <label><b style={{ display: "block", marginBottom: 5, color: "#1e3a8a", fontSize: 12 }}>기존 제품개발 프로젝트</b><select value={projectLinkDraftId} onChange={(event) => setProjectLinkDraftId(event.target.value)} style={inputStyle}><option value="">프로젝트 선택</option>{selectableProjects.map((project) => <option key={project.id} value={String(project.id)}>{project.name} · {project.category} · {project.status === "completed" ? "완료" : (project.status === "on_hold" ? "보류" : "진행")}</option>)}</select></label>
            <div style={{ display: "flex", gap: 6 }}><button type="button" onClick={saveProjectLink} style={{ ...buttonStyle, background: "#0f172a", color: "#fff" }}>연결</button><button type="button" onClick={() => setLinkingProject(false)} style={buttonStyle}>취소</button></div>
            {selectableProjects.length === 0 && <div style={{ gridColumn: "1 / -1", color: "#64748b", fontSize: 11 }}>연결 가능한 기존 프로젝트가 없습니다.</div>}
          </div>}
        </section>
      </div>}</main>
    </div>

    <style jsx>{`@media(max-width:1100px){.promotion-page-layout{grid-template-columns:1fr!important}.promotion-page-layout aside{position:static!important}.promotion-lifecycle,.promotion-summary-grid,.promotion-data-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.promotion-edit-grid{grid-template-columns:1fr 1fr!important}}@media(max-width:680px){.promotion-lifecycle,.promotion-summary-grid,.promotion-data-grid,.promotion-edit-grid{grid-template-columns:1fr!important}}`}</style>
  </div>;
}
