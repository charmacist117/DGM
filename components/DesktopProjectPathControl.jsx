"use client";

import { useEffect, useState } from "react";

export default function DesktopProjectPathControl() {
  const [supported, setSupported] = useState(false);
  const [open, setOpen] = useState(false);
  const [projectPath, setProjectPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/desktop/launcher-path", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!active || !payload?.ok) return;
        setSupported(true);
        setProjectPath(payload.projectPath || "");
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const savePath = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/desktop/launcher-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath })
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "경로를 저장하지 못했습니다.");
      setProjectPath(payload.projectPath);
      setOpen(false);
      window.alert("파일 경로를 저장했습니다. 프로그램을 종료한 뒤 다시 실행하면 새 경로가 적용됩니다.");
    } catch (saveError) {
      setError(saveError?.message || "경로를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (!supported) return null;

  return (
    <>
      <button type="button" onClick={() => { setError(""); setOpen(true); }} style={{ marginLeft: "auto", height: 42, padding: "0 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,.32)", background: "rgba(255,255,255,.1)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 800 }}>
        파일 경로 변경
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.56)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="desktop-path-title" style={{ width: "min(680px, 100%)", background: "#fff", borderRadius: 8, border: "1px solid #cbd5e1", boxShadow: "0 24px 60px rgba(15,23,42,.28)", padding: 22 }}>
            <div id="desktop-path-title" style={{ fontSize: 19, fontWeight: 900, color: "#0f172a" }}>실행 파일 경로 변경</div>
            <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, color: "#475569" }}>다음 실행부터 아래 폴더의 제품개발 프로그램 파일을 사용합니다.</div>
            <label htmlFor="desktop-project-path" style={{ display: "block", marginTop: 16, marginBottom: 6, fontSize: 12, fontWeight: 800, color: "#334155" }}>DGM-Desktop 폴더 경로</label>
            <input id="desktop-project-path" value={projectPath} onChange={(event) => setProjectPath(event.target.value)} autoFocus style={{ width: "100%", boxSizing: "border-box", padding: "10px 11px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }} />
            {error && <div style={{ marginTop: 10, padding: "9px 11px", borderRadius: 6, background: "#fef2f2", color: "#b91c1c", fontSize: 12, fontWeight: 700 }}>{error}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button type="button" onClick={() => setOpen(false)} disabled={saving} style={{ padding: "9px 13px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontWeight: 700 }}>취소</button>
              <button type="button" onClick={savePath} disabled={saving || !projectPath.trim()} style={{ padding: "9px 13px", borderRadius: 8, border: 0, background: "#0f172a", color: "#fff", cursor: "pointer", fontWeight: 800, opacity: saving || !projectPath.trim() ? .55 : 1 }}>{saving ? "저장 중" : "경로 저장"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
