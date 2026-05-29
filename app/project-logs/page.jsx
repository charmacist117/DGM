"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const cardStyle = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10 };

function normalizeLogs(logs) {
  return (logs || []).filter(Boolean).map((log) => ({
    id: log.id || Date.now() + Math.floor(Math.random() * 1000),
    type: log.type || "project_event",
    projectId: log.projectId ?? null,
    projectName: log.projectName || "-",
    reason: log.reason || "",
    actor: log.actor || "관리자",
    createdAt: log.createdAt || new Date().toISOString(),
    hiddenForManager: Boolean(log.hiddenForManager)
  }));
}

export default function ProjectLogsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState("guest");
  const isAdmin = userRole === "admin";

  useEffect(() => {
    let disposed = false;

    async function load() {
      try {
        setLoading(true);
        const [dataResp, sessionResp] = await Promise.all([
          fetch("/api/projects", { cache: "no-store" }),
          fetch("/api/auth/session", { cache: "no-store" })
        ]);
        const dataPayload = await dataResp.json().catch(() => ({}));
        const sessionPayload = await sessionResp.json().catch(() => ({}));
        if (!dataResp.ok || !dataPayload.ok) {
          throw new Error(dataPayload.error || dataPayload.message || "조회 실패");
        }
        if (disposed) return;
        setProjects(Array.isArray(dataPayload.projects) ? dataPayload.projects : []);
        setLogs(normalizeLogs(Array.isArray(dataPayload.adminLogs) ? dataPayload.adminLogs : []));
        setUserRole(sessionPayload?.role === "admin" ? "admin" : "guest");
      } catch (e) {
        if (!disposed) setError(String(e?.message || e));
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    load();
    return () => { disposed = true; };
  }, []);

  const visibleLogs = useMemo(
    () => [...logs]
      .filter((log) => (isAdmin ? true : !log.hiddenForManager))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [logs, isAdmin]
  );

  const persist = async (nextLogs) => {
    setSaving(true);
    setError("");
    try {
      const resp = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects, adminLogs: nextLogs })
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok || !payload.ok) {
        throw new Error(payload.error || payload.message || "저장 실패");
      }
      setLogs(nextLogs);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: 20 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={{ ...cardStyle, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>프로젝트 이력 로그</div>
          <button
            onClick={() => router.push("/")}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
          >
            돌아가기
          </button>
        </div>

        {error && <div style={{ ...cardStyle, padding: 10, color: "#dc2626" }}>{error}</div>}

        <div style={{ ...cardStyle, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
            권한: {isAdmin ? "ADMIN" : "MANAGER"} {saving ? "· 저장중..." : ""}
          </div>

          {loading ? (
            <div>불러오는 중...</div>
          ) : (
            visibleLogs.map((log) => (
              <div key={log.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700 }}>{log.projectName}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {log.hiddenForManager && (
                      <span style={{ fontSize: 11, background: "#fef3c7", padding: "2px 8px", borderRadius: 999 }}>
                        MANAGER 숨김
                      </span>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => persist(normalizeLogs(logs.map((it) => (it.id === log.id ? { ...it, hiddenForManager: !it.hiddenForManager } : it))))}
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d6d3d1", background: "#fff", cursor: "pointer" }}
                      >
                        {log.hiddenForManager ? "MANAGER에 표시" : "MANAGER에 숨김"}
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => persist(normalizeLogs(logs.filter((it) => it.id !== log.id)))}
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #fecaca", background: "#fff", color: "#dc2626", cursor: "pointer" }}
                      >
                        로그 삭제
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 6 }}>사유: {log.reason || "-"}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}
                </div>
              </div>
            ))
          )}

          {!loading && visibleLogs.length === 0 && (
            <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: 20 }}>
              로그가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
