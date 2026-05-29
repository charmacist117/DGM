"use client";

import { useEffect, useState } from "react";

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontSize: 14
};

export default function AuthGate({ children }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const checkSession = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      setAuthenticated(response.ok);
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        setError(payload.message || "로그인에 실패했습니다.");
        return;
      }
      setCode("");
      await checkSession();
    } catch (e) {
      setError(String(e?.message || e));
    }
  };

  if (loading) {
    return <div style={{ padding: 24, fontSize: 14 }}>인증 상태 확인 중...</div>;
  }

  if (authenticated) return children;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form onSubmit={submit} style={{ width: 360, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>참약사 PB 제품개발 시트 로그인</div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>관리자 또는 매니저 인증코드를 입력해주세요.</div>
        <input
          type="password"
          placeholder="인증코드"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={inputStyle}
        />
        {error ? <div style={{ marginTop: 10, color: "#dc2626", fontSize: 12 }}>{error}</div> : null}
        <button
          type="submit"
          style={{ marginTop: 14, width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", background: "#0f172a", color: "#fff", fontWeight: 700, cursor: "pointer" }}
        >
          로그인
        </button>
      </form>
    </div>
  );
}
