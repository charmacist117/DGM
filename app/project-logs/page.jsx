"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const cardStyle = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 10
};

function typeLabel(type) {
  if (type === "project_create") return "신설";
  if (type === "project_delete") return "삭제";
  if (type === "task_start_date_change") return "태스크 일정";
  if (type === "project_start_date_change") return "프로젝트 날짜";
  if (type === "basic_info_update") return "기본정보";
  if (type === "advisor_log_add") return "자문약사";
  if (type === "communication_log_add") return "업체소통";
  if (type === "decision_log_add") return "의사결정";
  if (type === "stage_check_yes") return "점검(Y)";
  if (type === "stage_check_issue") return "점검(N)";
  return "기록";
}

function typeColor(type) {
  if (type === "project_create") return { fg: "#166534", bg: "#dcfce7" };
  if (type === "project_delete") return { fg: "#b91c1c", bg: "#fee2e2" };
  if (type === "task_start_date_change" || type === "project_start_date_change") return { fg: "#1d4ed8", bg: "#dbeafe" };
  if (type === "basic_info_update") return { fg: "#7c3aed", bg: "#f3e8ff" };
  if (type === "advisor_log_add" || type === "communication_log_add" || type === "decision_log_add") return { fg: "#0f766e", bg: "#ccfbf1" };
  if (type === "stage_check_yes") return { fg: "#166534", bg: "#dcfce7" };
  if (type === "stage_check_issue") return { fg: "#b91c1c", bg: "#fee2e2" };
  return { fg: "#475569", bg: "#e2e8f0" };
}

function normalizeLogs(logs) {
  return (logs || [])
    .filter((log) => log && typeof log === "object")
    .map((log) => ({
      id: log.id || Date.now() + Math.floor(Math.random() * 1000),
      type: log.type || "project_event",
      projectId: log.projectId ?? null,
      projectName: log.projectName || "-",
      reason: log.reason || "",
      actor: log.actor || "관리자",
      createdAt: log.createdAt || new Date().toISOString()
    }));
}

export default function ProjectLogsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const resp = await fetch("/api/projects", { cache: "no-store" });
        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok || !payload.ok) {
          throw new Error(payload.error || payload.message || "데이터 조회 실패");
        }
        if (disposed) return;
        setProjects(Array.isArray(payload.projects) ? payload.projects : []);
        setLogs(normalizeLogs(Array.isArray(payload.adminLogs) ? payload.adminLogs : []));
      } catch (e) {
        if (!disposed) setError(String(e?.message || e || "데이터를 불러오지 못했습니다."));
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    load();
    return () => {
      disposed = true;
    };
  }, []);

  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
    [logs]
  );

  const persistLogs = async (nextLogs) => {
    setSaving(true);
    setError("");
    try {
      const resp = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projects,
          adminLogs: nextLogs
        })
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok || !payload.ok) {
        throw new Error(payload.error || payload.message || "로그 저장 실패");
      }
      setLogs(nextLogs);
    } catch (e) {
      setError(String(e?.message || e || "로그 저장에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: 20 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={{ ...cardStyle, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>프로젝트 이력 로그</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              생성/삭제, 날짜 변경, 기록 추가 이력을 한 곳에서 확인합니다.
            </div>
          </div>
          <button
            onClick={() => router.push("/")}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", cursor: "pointer", fontWeight: 700 }}
          >
            프로젝트 화면으로
          </button>
        </div>

        {error && (
          <div style={{ ...cardStyle, padding: "10px 12px", color: "#dc2626", background: "#fef2f2", borderColor: "#fecaca", fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ ...cardStyle, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
              로그 {loading ? "불러오는 중..." : `${sortedLogs.length}건`}
            </div>
            {saving && <div style={{ fontSize: 12, color: "#0369a1", fontWeight: 700 }}>저장 중...</div>}
          </div>

          {loading ? (
            <div style={{ padding: "16px 0", textAlign: "center", fontSize: 12, color: "#64748b" }}>데이터를 불러오는 중입니다.</div>
          ) : sortedLogs.length === 0 ? (
            <div style={{ padding: "16px 0", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>기록된 로그가 없습니다.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {sortedLogs.map((log) => {
                const badge = typeColor(log.type);
                return (
                  <div key={log.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: badge.fg, background: badge.bg, borderRadius: 999, padding: "2px 8px" }}>
                          {typeLabel(log.type)}
                        </span>
                        <button
                          onClick={() => {
                            if (!log.projectId) return;
                            router.push(`/?project=${log.projectId}`);
                          }}
                          style={{ border: "none", background: "transparent", color: "#0f172a", fontSize: 13, fontWeight: 700, cursor: log.projectId ? "pointer" : "default", padding: 0 }}
                          title={log.projectId ? "해당 프로젝트로 이동" : ""}
                        >
                          {log.projectName}
                        </button>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{log.actor}</span>
                      </div>
                      <button
                        onClick={() => {
                          if (!window.confirm("이 로그를 삭제하시겠습니까?")) return;
                          persistLogs(normalizeLogs(logs.filter((item) => item.id !== log.id)));
                        }}
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #fecaca", background: "#fff", color: "#dc2626", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                        disabled={saving}
                      >
                        로그 삭제
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>
                      사유: {log.reason || "-"}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
