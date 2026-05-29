"use client";

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
  moveProjectToBucket,
  selectedId,
  openProject,
  formatOwners,
  TODAY
}) {
  return (
    <aside style={{ width: 280, background: "#0f172a", color: "#fff", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900 }}>PharmaDev PMS</div>
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
            width: 34, height: 34, borderRadius: 8,
            border: isHome ? "1px solid #7c3aed" : "1px solid #475569",
            background: isHome ? "#7c3aed" : "transparent",
            color: "#fff", cursor: "pointer", fontSize: 16,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
          }}
          title="홈 대시보드"
        >
          ⌂
        </button>
      </div>

      {isAdmin && <button onClick={goToNewProjectPage} style={{ width: "100%", borderRadius: 8, padding: "8px 10px", border: "1px dashed #475569", background: "transparent", color: "#cbd5e1", cursor: "pointer", fontWeight: 700 }}>+ 새 프로젝트</button>}
      {isAdmin && <button onClick={goToProjectLogsPage} style={{ width: "100%", borderRadius: 8, padding: "8px 10px", border: "1px solid #334155", background: "#111827", color: "#cbd5e1", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>프로젝트 이력 전체보기</button>}

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gap: 8, paddingRight: 4 }}>
        {projectBuckets.map((bucket) => (
          <div
            key={bucket.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const projectId = Number(e.dataTransfer.getData("text/project-id"));
              if (Number.isFinite(projectId)) moveProjectToBucket(projectId, bucket.id);
            }}
            style={{ border: "1px solid #334155", borderRadius: 8, padding: 8, background: "#111827" }}
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
                    onDragStart={(e) => e.dataTransfer.setData("text/project-id", String(project.id))}
                    onClick={() => openProject(project.id)}
                    style={{
                      textAlign: "left",
                      borderRadius: 9,
                      border: "1px solid " + (active ? "#475569" : "transparent"),
                      background: active ? "#1e293b" : "transparent",
                      color: "#f8fafc",
                      padding: 10,
                      cursor: "pointer"
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
    </aside>
  );
}
