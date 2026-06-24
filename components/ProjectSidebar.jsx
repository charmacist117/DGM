"use client";

import { useState } from "react";
import { diff } from "@/lib/pms/date";

export default function ProjectSidebar({
  isHome,
  setIsHome,
  setTab,
  isAdmin,
  goToNewProjectPage,
  goToProjectLogsPage,
  groupedProjects,
  projectBuckets,
  reorderProject,
  selectedId,
  openProject,
  formatOwners,
  TODAY
}) {
  const [draggingProjectId, setDraggingProjectId] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);

  const readDraggedProjectId = (event) => event.dataTransfer.getData("text/project-id");

  return (
    <aside style={{ width: 280, background: "#0f172a", color: "#fff", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900 }}>참약사 PB 제품개발 시트</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Vercel Neon Storage</div>
        </div>
        <button
          onClick={() => {
            setIsHome(true);
            setTab("overview");
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              url.searchParams.delete("project");
              window.history.replaceState({}, "", url.toString());
            }
          }}
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: isHome ? "1px solid #7c3aed" : "1px solid #475569",
            background: isHome ? "#7c3aed" : "transparent",
            color: "#fff",
            cursor: "pointer",
            fontSize: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}
          title="홈 대시보드"
        >
          🏠
        </button>
      </div>

      {isAdmin && (
        <button
          onClick={goToNewProjectPage}
          style={{ width: "100%", borderRadius: 8, padding: "8px 10px", border: "1px dashed #475569", background: "transparent", color: "#cbd5e1", cursor: "pointer", fontWeight: 700 }}
        >
          + 새 프로젝트
        </button>
      )}
      {isAdmin && (
        <button
          onClick={goToProjectLogsPage}
          style={{ width: "100%", borderRadius: 8, padding: "8px 10px", border: "1px solid #334155", background: "#111827", color: "#cbd5e1", cursor: "pointer", fontWeight: 700, fontSize: 12 }}
        >
          프로젝트 이력 전체보기
        </button>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gap: 8, paddingRight: 4 }}>
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
              border: "1px solid " + (dragOverTarget === `bucket:${bucket.id}` ? bucket.color : "#334155"),
              borderRadius: 8,
              padding: 8,
              background: dragOverTarget === `bucket:${bucket.id}` ? "#172033" : "#111827",
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
                      setDraggingProjectId(project.id);
                    }}
                    onDragEnd={() => {
                      setDraggingProjectId(null);
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
                      border: "1px solid " + (dragOverTarget === `project:${project.id}` ? bucket.color : (active ? "#475569" : "transparent")),
                      background: active ? "#1e293b" : "transparent",
                      color: "#f8fafc",
                      padding: 10,
                      cursor: "grab",
                      opacity: draggingProjectId === project.id ? 0.45 : 1,
                      transition: "opacity .12s ease, border-color .12s ease, background .12s ease"
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>{project.name}</div>
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

      <div style={{ padding: "8px 10px 2px", borderTop: "1px solid #1e293b", color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: 0 }}>
        made by JB, Charmacist
      </div>
    </aside>
  );
}
