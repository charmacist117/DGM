"use client";

import { useMemo, useState } from "react";
import IngredientAmountTitle, { formatIngredientAmountLabel } from "@/components/IngredientAmountTitle";
import { marketDecisionLabel } from "@/lib/pms/marketDecision";
import {
  normalizeProjectPromotion,
  projectPromotionReadiness,
  promotionProgressLabel
} from "@/lib/pms/projectPromotion";

const panelStyle = {
  background: "#fff",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  overflow: "hidden"
};

const controlStyle = {
  minHeight: 38,
  padding: "8px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  background: "#fff",
  color: "#0f172a",
  fontSize: 13,
  boxSizing: "border-box"
};

function ingredientLabel(item) {
  const ingredients = formatIngredientAmountLabel(item, "성분·함량 미입력");
  return item?.productName ? `${item.productName} · ${ingredients}` : ingredients;
}

function linkedProjectFor(item, projects) {
  const promotion = normalizeProjectPromotion(item.projectPromotion);
  return (projects || []).find((project) => (
    String(project.id) === String(promotion.linkedProjectId)
    || String(project.sourceSupplyItemId || "") === String(item.id)
  )) || null;
}

function projectScheduleProgress(project) {
  if (!project) return 0;
  if (project.status === "completed") return 1;
  const tasks = (project.tasks || []).filter((task) => task.enabled !== false);
  if (!tasks.length) return 0;
  return tasks.filter((task) => task.taskStatus === "completed").length / tasks.length;
}

function statusTone(complete) {
  return complete
    ? { color: "#047857", background: "#ecfdf5", borderColor: "#a7f3d0" }
    : { color: "#64748b", background: "#f8fafc", borderColor: "#cbd5e1" };
}

function StageButton({ complete, label, detail, onClick }) {
  const tone = statusTone(complete);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 62,
        padding: "8px 9px",
        border: `1px solid ${tone.borderColor}`,
        borderRadius: 6,
        background: tone.background,
        color: tone.color,
        textAlign: "left",
        cursor: "pointer"
      }}
    >
      <span style={{ display: "block", fontSize: 12, fontWeight: 900 }}>{label}</span>
      <span
        title={detail}
        style={{
          display: "block",
          marginTop: 4,
          color: complete ? "#065f46" : "#64748b",
          fontSize: 11,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}
      >
        {detail}
      </span>
    </button>
  );
}

function ProgressBar({ value }) {
  const percentage = Math.max(0, Math.min(100, Math.round(value * 100)));
  const complete = percentage === 100;
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 900 }}>
        <span style={{ color: complete ? "#047857" : "#1d4ed8" }}>{percentage}%</span>
        <span style={{ color: "#64748b", fontSize: 11 }}>{complete ? "전 단계 완료" : "진행 중"}</span>
      </div>
      <div style={{ height: 7, marginTop: 7, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
        <div style={{ width: `${percentage}%`, height: "100%", borderRadius: 999, background: complete ? "#10b981" : "#2563eb" }} />
      </div>
    </div>
  );
}

export default function ProductDevelopmentOverviewTab({
  items = [],
  projects = [],
  syncState,
  onOpenSupply,
  onOpenDistribution,
  onOpenMarket,
  onOpenPromotion,
  onOpenSchedule,
  onOpenScheduleHome,
  stageFilter = "all",
  onStageFilterChange
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const rows = useMemo(() => (items || []).map((item) => {
    const readiness = projectPromotionReadiness(item);
    const promotion = normalizeProjectPromotion(item.projectPromotion);
    const linkedProject = linkedProjectFor(item, projects);
    const scheduleProgress = projectScheduleProgress(linkedProject);
    const promotionComplete = Boolean(promotion.updatedAt);
    const stageValues = [
      readiness.supplyReady ? 1 : 0,
      readiness.distributionReady ? 1 : 0,
      readiness.marketReady ? 1 : 0,
      promotionComplete ? 1 : 0,
      scheduleProgress
    ];
    const progress = stageValues.reduce((sum, value) => sum + value, 0) / stageValues.length;
    const currentStage = !readiness.supplyReady
      ? "supply"
      : !readiness.distributionReady
        ? "distribution"
        : !readiness.marketReady
          ? "market"
          : !promotionComplete
            ? "promotion"
            : scheduleProgress < 1
              ? "schedule"
              : "complete";
    return {
      item,
      label: ingredientLabel(item),
      readiness,
      promotion,
      promotionComplete,
      linkedProject,
      scheduleProgress,
      progress,
      currentStage
    };
  }), [items, projects]);

  const categories = useMemo(() => [...new Set(rows.map((row) => row.item.category).filter(Boolean))], [rows]);
  const visibleRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return rows
      .filter((row) => category === "all" || row.item.category === category)
      .filter((row) => stageFilter === "all" || row.currentStage === stageFilter)
      .filter((row) => !keyword || [
        row.label,
        row.item.manufacturer,
        row.item.permitCompany,
        row.item.category,
        row.linkedProject?.name
      ].some((value) => String(value || "").toLowerCase().includes(keyword)))
      .sort((left, right) => Number(left.currentStage === "complete") - Number(right.currentStage === "complete")
        || right.progress - left.progress
        || String(right.item.updatedAt || right.item.createdAt || "").localeCompare(String(left.item.updatedAt || left.item.createdAt || "")));
  }, [rows, query, category, stageFilter]);

  const completeCount = rows.filter((row) => row.progress === 1).length;
  const averageProgress = rows.length
    ? Math.round((rows.reduce((sum, row) => sum + row.progress, 0) / rows.length) * 100)
    : 0;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section style={{ ...panelStyle, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 23, fontWeight: 900, color: "#0f172a" }}>제품개발</div>
            <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>
              공급 성분·함량 조합을 기준으로 기획부터 일정 관리까지의 준비 상태를 확인합니다.
            </div>
          </div>
          <div style={{ color: "#047857", fontSize: 12, fontWeight: 800 }}>{syncState?.message || "변경 내용 자동 저장"}</div>
        </div>

        <div className="development-overview-summary" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: 14, border: "1px solid #dbe3ee", borderRadius: 7, overflow: "hidden" }}>
          {[
            ["전체 기준 품목", `${rows.length}건`],
            ["전 단계 완료", `${completeCount}건`],
            ["보완 필요", `${rows.length - completeCount}건`],
            ["평균 진척도", `${averageProgress}%`]
          ].map(([label, value], index) => (
            <div key={label} style={{ padding: "11px 13px", borderRight: index < 3 ? "1px solid #dbe3ee" : "none", background: index === 3 ? "#eff6ff" : "#fff" }}>
              <div style={{ color: "#64748b", fontSize: 11, fontWeight: 800 }}>{label}</div>
              <div style={{ marginTop: 4, color: "#0f172a", fontSize: 18, fontWeight: 900 }}>{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ ...panelStyle, padding: 12 }}>
        <div className="development-overview-controls" style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 180px 180px", gap: 8 }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="성분·함량, 제조사, 허가사 또는 프로젝트 검색" style={controlStyle} />
          <select value={category} onChange={(event) => setCategory(event.target.value)} style={controlStyle}>
            <option value="all">전체 카테고리</option>
            {categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={stageFilter} onChange={(event) => onStageFilterChange?.(event.target.value)} style={controlStyle}>
            <option value="all">전체 진행 단계</option>
            <option value="supply">공급단가 확인</option>
            <option value="distribution">유통 구조 설정</option>
            <option value="market">시장 규모 분석</option>
            <option value="promotion">프로젝트 추진</option>
            <option value="schedule">제품일정·간트</option>
            <option value="complete">전 단계 완료</option>
          </select>
        </div>
      </section>

      <section style={panelStyle}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 1260, borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "25%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>
            <thead>
              <tr style={{ background: "#dbeafe", color: "#1e3a8a" }}>
                {["기준 성분·함량", "공급단가", "유통 구조 설정", "시장 규모 분석", "프로젝트 추진", "제품일정·간트", "전체 진척도"].map((label) => (
                  <th key={label} style={{ padding: "10px 11px", borderBottom: "1px solid #bfdbfe", textAlign: "left", fontSize: 12, fontWeight: 900 }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const { item, readiness, promotion, linkedProject, scheduleProgress } = row;
                const scheduleComplete = Boolean(linkedProject) && scheduleProgress === 1;
                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid #e2e8f0", background: "#fff" }}>
                    <td style={{ padding: 11, verticalAlign: "top" }}>
                      <IngredientAmountTitle label={row.label} maxFontSize={13} minFontSize={11} />
                      <div style={{ marginTop: 5, color: "#64748b", fontSize: 11, lineHeight: 1.45 }}>{item.manufacturer || "제조사 미입력"} · {item.category || "카테고리 미입력"}</div>
                      <div style={{ marginTop: 2, color: "#64748b", fontSize: 11 }}>포장단위 {item.packagingUnit || "-"} · 수량 {item.quantity || "-"}</div>
                    </td>
                    <td style={{ padding: 8 }}><StageButton complete={readiness.supplyReady} label={readiness.supplyReady ? "구성 완료" : "미완료"} detail={item.supplyUnitPrice ? `배치 당 ${Number(String(item.supplyUnitPrice).replace(/,/g, "") || 0).toLocaleString("ko-KR")}원` : "단가·수량 확인 필요"} onClick={() => onOpenSupply?.(item.id)} /></td>
                    <td style={{ padding: 8 }}><StageButton complete={readiness.distributionReady} label={readiness.distributionReady ? "구성 완료" : "미완료"} detail={readiness.distributionReady ? "판매가·마진 설정됨" : "유통 구조 설정 필요"} onClick={() => onOpenDistribution?.(item.id)} /></td>
                    <td style={{ padding: 8 }}><StageButton complete={readiness.marketReady} label={readiness.marketReady ? "구성 완료" : "미완료"} detail={readiness.marketReady ? `검토결과 · ${marketDecisionLabel(item.marketDecisionStatus)}` : "시장 자료 입력 필요"} onClick={() => onOpenMarket?.(item.id)} /></td>
                    <td style={{ padding: 8 }}><StageButton complete={row.promotionComplete} label={row.promotionComplete ? "구성 완료" : "미완료"} detail={row.promotionComplete ? `최종 진행 · ${promotionProgressLabel(promotion.progressDecision)}` : (readiness.isImminent ? "추진 계획 설정 필요" : "시장 검토 선행 필요")} onClick={() => readiness.isImminent ? onOpenPromotion?.(item.id) : onOpenMarket?.(item.id)} /></td>
                    <td style={{ padding: 8 }}><StageButton complete={scheduleComplete} label={scheduleComplete ? "일정 완료" : (linkedProject ? `진행 ${Math.round(scheduleProgress * 100)}%` : "미생성")} detail={linkedProject?.name || "연결 프로젝트 없음"} onClick={() => linkedProject ? onOpenSchedule?.(linkedProject.id) : onOpenScheduleHome?.()} /></td>
                    <td style={{ padding: 11, verticalAlign: "middle" }}><ProgressBar value={row.progress} /></td>
                  </tr>
                );
              })}
              {visibleRows.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 28, color: "#94a3b8", textAlign: "center", fontSize: 12 }}>조건에 맞는 공급 성분·함량 조합이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <style jsx>{`
        @media(max-width:900px){
          .development-overview-summary{grid-template-columns:repeat(2,minmax(0,1fr))!important}
          .development-overview-controls{grid-template-columns:1fr!important}
        }
      `}</style>
    </div>
  );
}
