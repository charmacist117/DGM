"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORIES,
  DRAFT_CHECKLIST_FIELDS,
  EXCLUSIVITY_OPTIONS,
  REGULATORY_DIRECTION_OPTIONS,
  createEmptyDraftChecklist,
  createProjectFromForm,
  isOtcEtcCategory
} from "@/lib/pms/defaults";
import { TODAY } from "@/lib/pms/date";

const fieldStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 14,
  background: "#fff"
};

const sectionStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 14,
  background: "#fff"
};

const buttonPrimary = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "none",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer"
};

const buttonGhost = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#475569",
  fontWeight: 700,
  cursor: "pointer"
};

export default function NewProjectPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    desc: "",
    pmName: "",
    amName: "",
    category: CATEGORIES[0],
    regulatoryDirection: "",
    exclusivityType: "",
    start: TODAY,
    draftChecklist: createEmptyDraftChecklist()
  });
  const showRegulatoryFields = isOtcEtcCategory(form.category);

  const updateChecklist = (key, value) => {
    setForm((prev) => ({
      ...prev,
      draftChecklist: {
        ...prev.draftChecklist,
        [key]: value
      }
    }));
  };

  const save = async () => {
    const name = form.name.trim();
    const pmName = form.pmName.trim();
    const amName = form.amName.trim();

    if (!name) {
      setError("프로젝트명을 입력해주세요.");
      return;
    }
    if (!pmName && !amName) {
      setError("PM 또는 AM 중 최소 1명을 입력해주세요.");
      return;
    }
    if (showRegulatoryFields && !form.regulatoryDirection) {
      setError("허가/생산 방향성을 선택해주세요.");
      return;
    }
    if (showRegulatoryFields && !form.exclusivityType) {
      setError("독점 구분을 선택해주세요.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const getResp = await fetch("/api/projects", { cache: "no-store" });
      const getPayload = await getResp.json().catch(() => ({}));
      if (!getResp.ok || !getPayload.ok) {
        throw new Error(getPayload.error || getPayload.message || "프로젝트 목록 조회 실패");
      }

      const currentProjects = Array.isArray(getPayload.projects) ? getPayload.projects : [];
      const currentAdminLogs = Array.isArray(getPayload.adminLogs) ? getPayload.adminLogs : [];

      const id = Date.now();
      const newProject = createProjectFromForm({
        id,
        name,
        desc: form.desc,
        pmName,
        amName,
        category: form.category,
        regulatoryDirection: form.regulatoryDirection,
        exclusivityType: form.exclusivityType,
        start: form.start || TODAY,
        draftChecklist: form.draftChecklist
      });

      const createLog = {
        id: Date.now() + 1,
        type: "project_create",
        projectId: id,
        projectName: newProject.name,
        reason: `신규 프로젝트 기안 생성 (PM: ${pmName || "-"}, AM: ${amName || "-"}, 카테고리: ${form.category})`,
        actor: "관리자",
        createdAt: new Date().toISOString()
      };

      const putResp = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projects: [...currentProjects, newProject],
          adminLogs: [...currentAdminLogs, createLog]
        })
      });
      const putPayload = await putResp.json().catch(() => ({}));
      if (!putResp.ok || !putPayload.ok) {
        throw new Error(putPayload.error || putPayload.message || "프로젝트 저장 실패");
      }

      router.push(`/?project=${id}`);
    } catch (e) {
      setError(String(e?.message || e || "저장 중 오류가 발생했습니다."));
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: 24 }}>
      <div style={{ maxWidth: 980, margin: "0 auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: "#0f172a" }}>새 프로젝트 기안 작성</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
            프로젝트 시작 전 기본정보와 선정/판매/허가/물량/생산 체크리스트를 먼저 작성합니다.
          </div>
        </div>

        <div style={{ padding: 18, display: "grid", gap: 14 }}>
          <section style={sectionStyle}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>기본정보</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>프로젝트명 *</label>
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} style={fieldStyle} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>카테고리 *</label>
                <select
                  value={form.category}
                  onChange={(e) => {
                    const category = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      category,
                      regulatoryDirection: isOtcEtcCategory(category) ? prev.regulatoryDirection : "",
                      exclusivityType: isOtcEtcCategory(category) ? prev.exclusivityType : ""
                    }));
                  }}
                  style={fieldStyle}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            {showRegulatoryFields && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>허가/생산 방향성 *</label>
                  <select
                    value={form.regulatoryDirection}
                    onChange={(e) => setForm((prev) => ({ ...prev, regulatoryDirection: e.target.value }))}
                    style={fieldStyle}
                  >
                    <option value="">선택</option>
                    {REGULATORY_DIRECTION_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>독점 구분 *</label>
                  <select
                    value={form.exclusivityType}
                    onChange={(e) => setForm((prev) => ({ ...prev, exclusivityType: e.target.value }))}
                    style={fieldStyle}
                  >
                    <option value="">선택</option>
                    {EXCLUSIVITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>PM</label>
                <input value={form.pmName} onChange={(e) => setForm((p) => ({ ...p, pmName: e.target.value }))} style={fieldStyle} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>AM</label>
                <input value={form.amName} onChange={(e) => setForm((p) => ({ ...p, amName: e.target.value }))} style={fieldStyle} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>시작일 *</label>
                <input type="date" value={form.start} onChange={(e) => setForm((p) => ({ ...p, start: e.target.value }))} style={fieldStyle} />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>기안 요약</label>
              <textarea
                rows={3}
                value={form.desc}
                onChange={(e) => setForm((p) => ({ ...p, desc: e.target.value }))}
                placeholder="프로젝트 목적, 제안 배경, 기대 효과를 간단히 적어주세요."
                style={{ ...fieldStyle, resize: "vertical" }}
              />
            </div>
          </section>

          <section style={sectionStyle}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>사전 체크리스트 및 기안내용</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
              작성한 내용은 프로젝트 기본정보에서 추후 수정할 수 있으며, 수정 시 변경 이력이 남습니다.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {DRAFT_CHECKLIST_FIELDS.map((field) => (
                <div key={field.key}>
                  <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 5 }}>{field.label}</label>
                  <textarea
                    rows={4}
                    value={form.draftChecklist[field.key] || ""}
                    onChange={(e) => updateChecklist(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    style={{ ...fieldStyle, resize: "vertical", minHeight: 92 }}
                  />
                </div>
              ))}
            </div>
          </section>

          {error && (
            <div style={{ fontSize: 12, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 10px" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
            <button onClick={() => router.push("/")} style={buttonGhost}>목록으로</button>
            <button onClick={save} disabled={saving} style={{ ...buttonPrimary, opacity: saving ? 0.7 : 1 }}>
              {saving ? "생성 중..." : "기안 저장 후 프로젝트 생성"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
