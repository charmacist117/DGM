"use client";

import { useMemo, useState } from "react";
import { diff } from "@/lib/pms/date";
import {
  contractStatusLabel,
  contractTypeLabel,
  normalizeContractRecords
} from "@/lib/pms/contracts";

function contractSidebarStatusTone(status, active) {
  if (status === "active") {
    return active
      ? { background: "#dcfce7", color: "#047857" }
      : { background: "rgba(16, 185, 129, .16)", color: "#6ee7b7" };
  }
  if (status === "renewal") {
    return active
      ? { background: "#fef3c7", color: "#b45309" }
      : { background: "rgba(245, 158, 11, .17)", color: "#fcd34d" };
  }
  if (status === "expired" || status === "terminated") {
    return active
      ? { background: "#fee2e2", color: "#b91c1c" }
      : { background: "rgba(248, 113, 113, .16)", color: "#fca5a5" };
  }
  return active
    ? { background: "#e2e8f0", color: "#475569" }
    : { background: "rgba(148, 163, 184, .16)", color: "#cbd5e1" };
}

export default function ProjectSidebar({
  isHome,
  setIsHome,
  setTab,
  moduleTab,
  setModuleTab,
  isAdmin,
  goToNewProjectPage,
  goToProjectLogsPage,
  groupedProjects,
  projectBuckets,
  supplyCategories = [],
  supplyCategory = "all",
  setSupplyCategory,
  supplyCategoryCounts = {},
  developmentStageFilter = "all",
  setDevelopmentStageFilter,
  contractRecords = [],
  contractParentScope = "all",
  setContractParentScope,
  settingsSection = "server",
  setSettingsSection,
  reorderProject,
  selectedId,
  openProject,
  formatOwners,
  TODAY
}) {
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const [contractParentSearch, setContractParentSearch] = useState("");
  const isDistributionMode = moduleTab === "distribution";
  const isMarketMode = moduleTab === "market";
  const isPromotionMode = moduleTab === "promotion";
  const isSupplyMode = moduleTab === "supply" || isDistributionMode || isMarketMode;
  const isContractMode = moduleTab === "contract";
  const isTransferMode = moduleTab === "transfer";
  const isStandaloneHomeMode = moduleTab === "home";
  const isDevelopmentOverviewMode = moduleTab === "development";
  const isScheduleMode = moduleTab === "schedule";
  const totalSupplyCount = Object.values(supplyCategoryCounts || {}).reduce((sum, count) => sum + Number(count || 0), 0);
  const supplyCategoryOptions = [
    { id: "all", label: "전체", color: "#e2e8f0", count: totalSupplyCount },
    ...supplyCategories.map((category) => ({
      ...category,
      count: Number(supplyCategoryCounts?.[category.id] || 0)
    }))
  ];
  const normalizedContractRecords = useMemo(
    () => normalizeContractRecords(contractRecords),
    [contractRecords]
  );
  const contractChildCounts = useMemo(() => {
    const counts = new Map();
    normalizedContractRecords
      .filter((record) => record.recordType === "child")
      .forEach((record) => {
        const parentId = String(record.parentId || "");
        counts.set(parentId, Number(counts.get(parentId) || 0) + 1);
      });
    return counts;
  }, [normalizedContractRecords]);
  const contractParentRecords = useMemo(() => {
    const keyword = contractParentSearch.trim().toLowerCase();
    return normalizedContractRecords
      .filter((record) => record.recordType === "parent")
      .filter((record) => !keyword || [
        record.title,
        record.contractNumber,
        record.counterparty,
        record.nasPath
      ].some((value) => String(value || "").toLowerCase().includes(keyword)))
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
        return bTime - aTime;
      });
  }, [contractParentSearch, normalizedContractRecords]);

  const readDraggedProjectId = (event) => event.dataTransfer.getData("text/project-id");
  const contractTitle = (record) => (
    record.title || `${record.counterparty || "계약 상대방 미입력"} ${contractTypeLabel(record)}`
  );

  return (
    <aside className="pms-project-sidebar" style={{
      width: 280,
      flex: "0 0 280px",
      height: "calc(100vh - var(--app-topbar-height, 0px))",
      maxHeight: "calc(100vh - var(--app-topbar-height, 0px))",
      position: "sticky",
      top: "var(--app-topbar-height, 0px)",
      alignSelf: "flex-start",
      overflow: "hidden",
      boxSizing: "border-box",
      background: "var(--app-nav-bg-strong, #0f172a)",
      color: "#fff",
      padding: 12,
      display: "flex",
      flexDirection: "column",
      gap: 10
    }}>
      <div style={{ padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900 }}>PB 제품개발 시트</div>
          <div style={{ fontSize: 11, color: "var(--app-nav-muted, #94a3b8)", fontWeight: 700 }}>
            {isDistributionMode
              ? "유통 구조 공급단가 목록"
              : (isMarketMode
                  ? "시장 규모 분석 품목 목록"
                  : (isPromotionMode
                  ? "추진 임박 프로젝트 관리"
                  : (isSupplyMode
                  ? "공급단가 카테고리"
                  : (isContractMode
                      ? "모계약 탐색 및 계약 범위"
                      : (isTransferMode
                      ? "서버 및 백업 설정"
                      : (isStandaloneHomeMode
                        ? "시스템 업데이트 안내"
                        : (isDevelopmentOverviewMode ? "전 과정 진척 현황" : "제품일정 및 간트 관리")))))))}
          </div>
        </div>
        <button
          onClick={() => {
            setModuleTab?.("home");
            setIsHome(true);
            setTab("overview");
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              url.searchParams.delete("project");
              window.history.replaceState({}, "", url.toString());
            }
          }}
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            border: isStandaloneHomeMode ? "1px solid #7dd3fc" : "1px solid rgba(56, 189, 248, .55)",
            background: isStandaloneHomeMode ? "#e0f2fe" : "rgba(14, 165, 233, .18)",
            color: isStandaloneHomeMode ? "#075985" : "#bae6fd",
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: isStandaloneHomeMode ? "0 5px 14px rgba(14, 165, 233, .22)" : "none"
          }}
          title="홈"
        >
          🏠
        </button>
      </div>

      {isScheduleMode && isAdmin && (
        <button
          onClick={goToNewProjectPage}
          style={{ width: "100%", borderRadius: 8, padding: "9px 10px", border: "1px dashed rgba(148, 163, 184, .55)", background: "rgba(255, 255, 255, .04)", color: "#e2e8f0", cursor: "pointer", fontWeight: 800 }}
        >
          + 새 프로젝트
        </button>
      )}
      {isScheduleMode && isAdmin && (
        <button
          onClick={goToProjectLogsPage}
          style={{ width: "100%", borderRadius: 8, padding: "9px 10px", border: "1px solid rgba(148, 163, 184, .28)", background: "rgba(30, 41, 59, .65)", color: "#e2e8f0", cursor: "pointer", fontWeight: 800, fontSize: 12 }}
        >
          프로젝트 이력 전체보기
        </button>
      )}

      {isPromotionMode ? (
        <div style={{ flex: 1, minHeight: 0, display: "grid", alignContent: "start", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#94a3b8", padding: "0 4px" }}>전 주기 연결</div>
          {["공급단가 확인", "유통 구조 설정", "시장 규모 분석", "추진 일정·비용", "제품개발 프로젝트", "계약·생산", "출시·운영"].map((label, index) => (
            <div key={label} style={{ padding: "9px 10px", border: "1px solid rgba(148, 163, 184, .28)", borderRadius: 7, background: index < 4 ? "rgba(14, 165, 233, .12)" : "rgba(30, 41, 59, .65)", color: index < 4 ? "#bae6fd" : "#cbd5e1", fontSize: 12, fontWeight: 800 }}>
              {index + 1}. {label}
            </div>
          ))}
        </div>
      ) : isContractMode ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#94a3b8", padding: "0 4px" }}>모계약</div>
          <input
            value={contractParentSearch}
            onChange={(event) => setContractParentSearch(event.target.value)}
            placeholder="모계약명, 상대방 검색"
            aria-label="모계약 검색"
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid rgba(148, 163, 184, .4)",
              borderRadius: 7,
              background: "#fff",
              color: "#0f172a",
              padding: "9px 10px",
              fontSize: 12,
              outline: "none"
            }}
          />
          <button
            type="button"
            onClick={() => setContractParentScope?.("all")}
            style={{
              width: "100%",
              borderRadius: 8,
              border: `1px solid ${contractParentScope === "all" ? "#e2e8f0" : "rgba(148, 163, 184, .28)"}`,
              background: contractParentScope === "all" ? "#fff" : "rgba(30, 41, 59, .65)",
              color: contractParentScope === "all" ? "#0f172a" : "#e2e8f0",
              cursor: "pointer",
              padding: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              textAlign: "left",
              fontSize: 12,
              fontWeight: 900
            }}
          >
            <span>전체 계약 보기</span>
            <span style={{ color: contractParentScope === "all" ? "#475569" : "#94a3b8", fontSize: 11 }}>
              {normalizedContractRecords.length}건
            </span>
          </button>
          <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            display: "grid",
            gridAutoRows: "max-content",
            alignContent: "start",
            gap: 7,
            paddingRight: 3
          }}>
            {contractParentRecords.map((record) => {
              const active = String(contractParentScope) === String(record.id);
              const childCount = Number(contractChildCounts.get(String(record.id)) || 0);
              const statusTone = contractSidebarStatusTone(record.status, active);
              return (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setContractParentScope?.(record.id)}
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    border: `1px solid ${active ? "#e2e8f0" : "rgba(148, 163, 184, .28)"}`,
                    background: active ? "#fff" : "rgba(30, 41, 59, .65)",
                    color: active ? "#0f172a" : "#f8fafc",
                    cursor: "pointer",
                    padding: 10,
                    textAlign: "left"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 7 }}>
                    <span style={{ minWidth: 0, fontSize: 12, lineHeight: 1.35, fontWeight: 900, overflowWrap: "anywhere" }}>
                      {contractTitle(record)}
                    </span>
                    <span style={{
                      flex: "0 0 auto",
                      borderRadius: 999,
                      padding: "2px 6px",
                      background: statusTone.background,
                      color: statusTone.color,
                      fontSize: 10,
                      fontWeight: 900
                    }}>
                      {contractStatusLabel(record.status)}
                    </span>
                  </div>
                  <div style={{ marginTop: 5, color: active ? "#475569" : "#94a3b8", fontSize: 10, lineHeight: 1.4 }}>
                    {contractTypeLabel(record)} · {record.counterparty || "상대방 미입력"}
                  </div>
                  <div style={{ marginTop: 5, display: "flex", justifyContent: "space-between", gap: 7, color: active ? "#334155" : "#cbd5e1", fontSize: 10, fontWeight: 800 }}>
                    <span>{record.contractNumber || "계약번호 미입력"}</span>
                    <span>하위 {childCount}건</span>
                  </div>
                </button>
              );
            })}
            {contractParentRecords.length === 0 && (
              <div style={{ padding: "14px 8px", border: "1px dashed rgba(148, 163, 184, .3)", borderRadius: 8, color: "#64748b", fontSize: 11, textAlign: "center" }}>
                {contractParentSearch.trim() ? "검색된 모계약이 없습니다." : "등록된 모계약이 없습니다."}
              </div>
            )}
          </div>
        </div>
      ) : isSupplyMode ? (
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "grid",
          gridAutoRows: "max-content",
          alignContent: "start",
          gap: 8,
          paddingRight: 4
        }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#94a3b8", padding: "0 4px 2px" }}>
            {isDistributionMode ? "유통 구조 카테고리" : (isMarketMode ? "시장 분석 카테고리" : "공급단가 카테고리")}
          </div>
          {supplyCategoryOptions.map((category) => {
            const active = supplyCategory === category.id;
            return (
              <button
                key={category.id}
                onClick={() => setSupplyCategory?.(category.id)}
                style={{
                  width: "100%",
                  borderRadius: 8,
                  border: "1px solid " + (active ? "#e2e8f0" : "rgba(148, 163, 184, .28)"),
                  background: active ? "#fff" : "rgba(30, 41, 59, .65)",
                  color: active ? "#0f172a" : "#e2e8f0",
                  cursor: "pointer",
                  padding: "11px 10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  textAlign: "left"
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: category.color, flex: "0 0 8px" }} />
                  <span style={{ fontSize: 13, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {category.label}
                  </span>
                </span>
                <span style={{ flex: "0 0 auto", fontSize: 11, color: active ? "#0f172a" : "var(--app-nav-muted, #94a3b8)", fontWeight: 800 }}>
                  {category.count}건
                </span>
              </button>
            );
          })}
        </div>
      ) : isTransferMode ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ border: "1px solid rgba(148, 163, 184, .28)", borderRadius: 8, background: "rgba(30, 41, 59, .62)", padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#f8fafc", marginBottom: 6 }}>환경설정</div>
            <div style={{ fontSize: 11, lineHeight: 1.6, color: "#94a3b8" }}>서버 상태를 확인하고 운영 데이터를 백업·복원합니다.</div>
          </div>
          {[
            ["server", "현재 서버 조회", "연결 상태와 저장공간 확인"],
            ["transfer", "데이터 이전", "전체·탭별 백업 및 복원"]
          ].map(([id, label, description]) => {
            const active = settingsSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSettingsSection?.(id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: active ? "1px solid #7dd3fc" : "1px solid rgba(148, 163, 184, .28)",
                  borderRadius: 8,
                  background: active ? "#e0f2fe" : "rgba(30, 41, 59, .62)",
                  color: active ? "#0f172a" : "#f8fafc",
                  padding: "10px 12px",
                  cursor: "pointer"
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 900 }}>{label}</div>
                <div style={{ marginTop: 3, fontSize: 10, color: active ? "#0369a1" : "#94a3b8" }}>{description}</div>
              </button>
            );
          })}
        </div>
      ) : isStandaloneHomeMode ? (
        <div style={{ flex: 1, minHeight: 0, border: "1px solid rgba(148, 163, 184, .28)", borderRadius: 8, background: "rgba(30, 41, 59, .62)", padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#f8fafc", marginBottom: 6 }}>홈</div>
          <div style={{ fontSize: 11, lineHeight: 1.6, color: "#94a3b8" }}>제품개발 시스템의 업데이트 및 변경사항을 확인합니다.</div>
        </div>
      ) : isDevelopmentOverviewMode ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ border: "1px solid rgba(148, 163, 184, .28)", borderRadius: 8, background: "rgba(30, 41, 59, .62)", padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#f8fafc", marginBottom: 6 }}>제품개발</div>
            <div style={{ fontSize: 11, lineHeight: 1.6, color: "#94a3b8" }}>진행 단계별 품목을 선택해 모아봅니다.</div>
          </div>
          <div style={{ minHeight: 0, overflowY: "auto", display: "grid", gridAutoRows: "max-content", alignContent: "start", gap: 7, paddingRight: 3 }}>
            {[
              ["all", "전체 단계", "#e2e8f0"],
              ["supply", "공급단가 확인", "#38bdf8"],
              ["distribution", "유통 구조 설정", "#2dd4bf"],
              ["market", "시장 규모 분석", "#fbbf24"],
              ["promotion", "프로젝트 추진", "#a78bfa"],
              ["schedule", "제품일정·간트", "#fb7185"],
              ["complete", "전 단계 완료", "#34d399"]
            ].map(([id, label, color]) => {
              const active = developmentStageFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDevelopmentStageFilter?.(id)}
                  style={{
                    width: "100%",
                    minHeight: 40,
                    padding: "9px 10px",
                    borderRadius: 8,
                    border: `1px solid ${active ? "#e2e8f0" : "rgba(148, 163, 184, .28)"}`,
                    background: active ? "#fff" : "rgba(30, 41, 59, .65)",
                    color: active ? "#0f172a" : "#e2e8f0",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    textAlign: "left",
                    fontSize: 12,
                    fontWeight: 900
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: color, flex: "0 0 8px" }} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "grid",
          gridAutoRows: "max-content",
          alignContent: "start",
          gap: 8,
          paddingRight: 4
        }}>
          {projectBuckets.map((bucket) => (
            <div
              key={bucket.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverTarget(`bucket:${bucket.id}`);
              }}
              onDragLeave={() => setDragOverTarget(null)}
              onDrop={(e) => {
                e.preventDefault();
                const projectId = readDraggedProjectId(e);
                if (projectId) reorderProject(projectId, bucket.id);
                setDragOverTarget(null);
              }}
              style={{
                border: "1px solid " + (dragOverTarget === `bucket:${bucket.id}` ? "#e2e8f0" : "rgba(148, 163, 184, .28)"),
                borderRadius: 8,
                padding: 8,
                background: dragOverTarget === `bucket:${bucket.id}` ? "rgba(255, 255, 255, .08)" : "rgba(30, 41, 59, .62)",
                transition: "border-color .12s ease, background .12s ease"
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: bucket.color, marginBottom: 6 }}>
                {bucket.label} ({groupedProjects[bucket.id].length})
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {groupedProjects[bucket.id].map((project) => {
                  const launch = project.tasks[project.tasks.length - 1];
                  const dDay = diff(TODAY, launch?.scheduledEnd || TODAY);
                  const active = !isHome && project.id === selectedId;
                  return (
                    <button
                      key={project.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/project-id", String(project.id));
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDragOverTarget(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverTarget(`project:${project.id}`);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const draggedProjectId = readDraggedProjectId(e);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const position = e.clientY > rect.top + rect.height / 2 ? "after" : "before";
                        if (draggedProjectId) reorderProject(draggedProjectId, bucket.id, project.id, position);
                        setDragOverTarget(null);
                      }}
                      onClick={() => openProject(project.id)}
                      style={{
                        textAlign: "left",
                        borderRadius: 9,
                        border: "1px solid " + (dragOverTarget === `project:${project.id}` ? "#e2e8f0" : (active ? "rgba(148, 163, 184, .5)" : "transparent")),
                        background: active ? "rgba(255, 255, 255, .08)" : "transparent",
                        color: "#f8fafc",
                        padding: 10,
                        cursor: "grab",
                        transition: "border-color .12s ease, background .12s ease"
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2, color: "#f8fafc" }}>{project.name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        {project.category} · D-{dDay} · {formatOwners(project)}
                      </div>
                    </button>
                  );
                })}
                {groupedProjects[bucket.id].length === 0 && (
                  <div style={{ fontSize: 11, color: "#64748b", padding: "6px 2px" }}>프로젝트 없음</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: "8px 10px 2px", borderTop: "1px solid rgba(148, 163, 184, .24)", color: "var(--app-nav-muted, #94a3b8)", fontSize: 10, fontWeight: 700, letterSpacing: 0 }}>
        made by JB
      </div>
    </aside>
  );
}
