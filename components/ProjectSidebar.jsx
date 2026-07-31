"use client";

import { useState } from "react";
import { diff } from "@/lib/pms/date";

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
  reorderProject,
  selectedId,
  openProject,
  formatOwners,
  TODAY
}) {
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const isDistributionMode = moduleTab === "distribution";
  const isMarketMode = moduleTab === "market";
  const isSupplyMode = moduleTab === "supply" || isDistributionMode || isMarketMode;
  const isContractMode = moduleTab === "contract";
  const isTransferMode = moduleTab === "transfer";
  const isStandaloneHomeMode = moduleTab === "home";
  const totalSupplyCount = Object.values(supplyCategoryCounts || {}).reduce((sum, count) => sum + Number(count || 0), 0);
  const supplyCategoryOptions = [
    { id: "all", label: "전체", color: "#e2e8f0", count: totalSupplyCount },
    ...supplyCategories.map((category) => ({
      ...category,
      count: Number(supplyCategoryCounts?.[category.id] || 0)
    }))
  ];

  const readDraggedProjectId = (event) => event.dataTransfer.getData("text/project-id");

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
                  : (isSupplyMode
                  ? "공급단가 카테고리"
                  : (isContractMode
                      ? "모계약 및 하위 계약·문서"
                      : (isTransferMode
                      ? "전체 백업 및 복원"
                      : (isStandaloneHomeMode ? "시스템 업데이트 안내" : "제품개발 통합관리")))))}
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

      {!isSupplyMode && !isContractMode && !isTransferMode && !isStandaloneHomeMode && isAdmin && (
        <button
          onClick={goToNewProjectPage}
          style={{ width: "100%", borderRadius: 8, padding: "9px 10px", border: "1px dashed rgba(148, 163, 184, .55)", background: "rgba(255, 255, 255, .04)", color: "#e2e8f0", cursor: "pointer", fontWeight: 800 }}
        >
          + 새 프로젝트
        </button>
      )}
      {!isSupplyMode && !isContractMode && !isTransferMode && !isStandaloneHomeMode && isAdmin && (
        <button
          onClick={goToProjectLogsPage}
          style={{ width: "100%", borderRadius: 8, padding: "9px 10px", border: "1px solid rgba(148, 163, 184, .28)", background: "rgba(30, 41, 59, .65)", color: "#e2e8f0", cursor: "pointer", fontWeight: 800, fontSize: 12 }}
        >
          프로젝트 이력 전체보기
        </button>
      )}

      {isContractMode ? (
        <div style={{ flex: 1, minHeight: 0, border: "1px solid rgba(148, 163, 184, .28)", borderRadius: 8, background: "rgba(30, 41, 59, .62)", padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#f8fafc", marginBottom: 6 }}>계약 관리</div>
          <div style={{ fontSize: 11, lineHeight: 1.6, color: "#94a3b8" }}>
            기본계약·포괄계약을 모계약으로 관리하고 개별계약, 부대합의서와 발주서를 연결합니다.
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
        <div style={{ flex: 1, minHeight: 0, border: "1px solid rgba(148, 163, 184, .28)", borderRadius: 8, background: "rgba(30, 41, 59, .62)", padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#f8fafc", marginBottom: 6 }}>데이터 이전</div>
          <div style={{ fontSize: 11, lineHeight: 1.6, color: "#94a3b8" }}>프로젝트, 이력, 공급단가를 하나의 백업 파일로 관리합니다.</div>
        </div>
      ) : isStandaloneHomeMode ? (
        <div style={{ flex: 1, minHeight: 0, border: "1px solid rgba(148, 163, 184, .28)", borderRadius: 8, background: "rgba(30, 41, 59, .62)", padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#f8fafc", marginBottom: 6 }}>홈</div>
          <div style={{ fontSize: 11, lineHeight: 1.6, color: "#94a3b8" }}>제품개발 시스템의 업데이트 및 변경사항을 확인합니다.</div>
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
