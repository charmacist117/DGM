"use client";

import { useEffect, useMemo, useState } from "react";
import SegmentedDateInput from "@/components/SegmentedDateInput";
import {
  CHILD_CONTRACT_TYPES,
  CONTRACT_STATUSES,
  PARENT_CONTRACT_TYPES,
  contractStatusLabel,
  contractTypeLabel,
  createContractRecord,
  normalizeContractRecord,
  normalizeContractRecords
} from "@/lib/pms/contracts";

const panelStyle = {
  background: "#fff",
  border: "1px solid #cbd5e1",
  borderRadius: 8
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  padding: "9px 10px",
  background: "#fff",
  color: "#0f172a",
  fontSize: 13
};

const primaryButton = {
  border: "1px solid #0f172a",
  borderRadius: 6,
  background: "#0f172a",
  color: "#fff",
  padding: "8px 11px",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer"
};

const subtleButton = {
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  background: "#fff",
  color: "#334155",
  padding: "8px 11px",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer"
};

function statusStyle(status) {
  const styles = {
    draft: { color: "#475569", background: "#f1f5f9", border: "#cbd5e1" },
    active: { color: "#047857", background: "#ecfdf5", border: "#a7f3d0" },
    renewal: { color: "#b45309", background: "#fffbeb", border: "#fde68a" },
    expired: { color: "#64748b", background: "#f8fafc", border: "#cbd5e1" },
    terminated: { color: "#b91c1c", background: "#fef2f2", border: "#fecaca" }
  };
  const style = styles[status] || styles.draft;
  return {
    display: "inline-flex",
    alignItems: "center",
    border: `1px solid ${style.border}`,
    borderRadius: 999,
    background: style.background,
    color: style.color,
    padding: "3px 7px",
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: "nowrap"
  };
}

function contractDisplayTitle(record) {
  return record.title || `${record.counterparty || "계약 상대방 미입력"} ${contractTypeLabel(record)}`;
}

function supplyItemLabel(item = {}) {
  const ingredients = (Array.isArray(item.ingredients) ? item.ingredients : [])
    .map((ingredient) => [ingredient?.name, ingredient?.content].filter(Boolean).join(" / "))
    .filter(Boolean)
    .join(", ");
  const packageLabel = [item.packagingUnit, item.packagingForm].filter(Boolean).join(" · ");
  return [ingredients || "성분 미입력", item.manufacturer, packageLabel].filter(Boolean).join(" | ");
}

function toTimestamp(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function daysUntil(value) {
  const target = Date.parse(value || "");
  if (!Number.isFinite(target)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today.getTime()) / 86400000);
}

function Field({ label, children, span = 1 }) {
  return (
    <label style={{ display: "grid", gap: 5, minWidth: 0, gridColumn: `span ${span}` }}>
      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 800 }}>{label}</span>
      {children}
    </label>
  );
}

function TextValue({ children }) {
  return <div style={{ minHeight: 18, color: "#0f172a", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{children || "-"}</div>;
}

export default function ContractManagementTab({
  records,
  onRecordsChange,
  projects = [],
  supplyPriceItems = [],
  syncState,
  isAdmin = false
}) {
  const normalizedRecords = useMemo(() => normalizeContractRecords(records), [records]);
  const parentRecords = useMemo(
    () => normalizedRecords.filter((record) => record.recordType === "parent"),
    [normalizedRecords]
  );
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [recordFilter, setRecordFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  useEffect(() => {
    if (selectedId && normalizedRecords.some((record) => String(record.id) === String(selectedId))) return;
    setSelectedId(normalizedRecords[0]?.id || "");
  }, [normalizedRecords, selectedId]);

  const selectedRecord = normalizedRecords.find((record) => String(record.id) === String(selectedId)) || null;
  const projectsById = useMemo(() => new Map(projects.map((project) => [String(project.id), project])), [projects]);
  const supplyItemsById = useMemo(
    () => new Map(supplyPriceItems.map((item) => [String(item.id), item])),
    [supplyPriceItems]
  );
  const childrenByParent = useMemo(() => {
    const map = new Map();
    normalizedRecords.filter((record) => record.recordType === "child").forEach((record) => {
      const key = String(record.parentId || "");
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(record);
    });
    return map;
  }, [normalizedRecords]);

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return normalizedRecords
      .filter((record) => recordFilter === "all" || record.recordType === recordFilter)
      .filter((record) => statusFilter === "all" || record.status === statusFilter)
      .filter((record) => !keyword || [
        record.title,
        record.contractNumber,
        record.counterparty,
        record.nasPath,
        projectsById.get(String(record.projectId))?.name
      ].some((value) => String(value || "").toLowerCase().includes(keyword)))
      .sort((a, b) => {
        if (a.recordType !== b.recordType) return a.recordType === "parent" ? -1 : 1;
        return toTimestamp(b.updatedAt || b.createdAt) - toTimestamp(a.updatedAt || a.createdAt);
      });
  }, [normalizedRecords, projectsById, recordFilter, search, statusFilter]);

  const expiringCount = normalizedRecords.filter((record) => {
    if (record.status !== "active" && record.status !== "renewal") return false;
    const days = daysUntil(record.expirationDate);
    return days !== null && days >= 0 && days <= 90;
  }).length;

  const beginAdd = (recordType) => {
    if (!isAdmin) return;
    if (recordType === "child" && parentRecords.length === 0) {
      window.alert("하위 계약·문서를 연결할 모계약을 먼저 등록해주세요.");
      return;
    }
    const next = createContractRecord(recordType, recordType === "child" ? parentRecords[0]?.id : "");
    setDraft(next);
    setSelectedId(next.id);
    setIsEditing(true);
  };

  const beginEdit = () => {
    if (!isAdmin || !selectedRecord) return;
    setDraft(normalizeContractRecord(selectedRecord));
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraft(null);
    if (!selectedRecord) setSelectedId(normalizedRecords[0]?.id || "");
  };

  const saveDraft = () => {
    if (!isAdmin || !draft) return;
    const next = normalizeContractRecord({ ...draft, updatedAt: new Date().toISOString() });
    if (!next.title) {
      window.alert("계약명을 입력해주세요.");
      return;
    }
    if (!next.counterparty) {
      window.alert("계약 상대방을 입력해주세요.");
      return;
    }
    if (next.recordType === "child" && !next.parentId) {
      window.alert("연결할 모계약을 선택해주세요.");
      return;
    }
    const exists = normalizedRecords.some((record) => String(record.id) === String(next.id));
    onRecordsChange(exists
      ? normalizedRecords.map((record) => String(record.id) === String(next.id) ? next : record)
      : [next, ...normalizedRecords]);
    setSelectedId(next.id);
    setDraft(null);
    setIsEditing(false);
  };

  const requestDelete = () => {
    if (!isAdmin || !selectedRecord) return;
    if (selectedRecord.recordType === "parent" && (childrenByParent.get(String(selectedRecord.id)) || []).length > 0) {
      window.alert("연결된 하위 계약·문서가 있어 모계약을 삭제할 수 없습니다. 하위 항목을 먼저 이동하거나 삭제해주세요.");
      return;
    }
    setDeleteTarget(selectedRecord);
    setDeleteConfirmation("");
  };

  const deleteRecord = () => {
    if (!isAdmin || !deleteTarget || deleteConfirmation !== "삭제합니다") return;
    const nextRecords = normalizedRecords.filter((record) => String(record.id) !== String(deleteTarget.id));
    onRecordsChange(nextRecords);
    setSelectedId(nextRecords[0]?.id || "");
    setDeleteTarget(null);
    setDeleteConfirmation("");
    setDraft(null);
    setIsEditing(false);
  };

  const copyNasPath = async (path) => {
    const value = String(path || "").trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      window.alert("NAS 경로를 복사했습니다.");
    } catch {
      window.prompt("아래 NAS 경로를 복사해주세요.", value);
    }
  };

  const openNasPath = async (path) => {
    const value = String(path || "").trim();
    if (!value) return;
    if (/^https?:\/\//i.test(value)) {
      window.open(value, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const response = await fetch("/api/desktop/open-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: value })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.message || "PC 경로 열기 미지원");
    } catch {
      try {
        await navigator.clipboard.writeText(value);
        window.alert("웹 브라우저에서는 NAS 경로를 직접 열 수 없어 경로를 복사했습니다. 파일 탐색기 주소창에 붙여 넣어주세요.");
      } catch {
        window.prompt("웹 브라우저에서는 NAS 경로를 직접 열 수 없습니다. 아래 경로를 복사해주세요.", value);
      }
    }
  };

  const renderRecordRow = (record) => {
    const active = String(record.id) === String(selectedId);
    const childCount = (childrenByParent.get(String(record.id)) || []).length;
    const linkedParent = record.recordType === "child"
      ? parentRecords.find((parent) => String(parent.id) === String(record.parentId))
      : null;
    return (
      <button
        key={record.id}
        type="button"
        onClick={() => {
          if (isEditing && String(record.id) !== String(selectedId)) {
            if (!window.confirm("저장하지 않은 수정 내용을 취소하고 다른 계약을 보시겠습니까?")) return;
            setIsEditing(false);
            setDraft(null);
          }
          setSelectedId(record.id);
        }}
        style={{
          width: "100%",
          textAlign: "left",
          border: `1px solid ${active ? "#2563eb" : "#dbe3ee"}`,
          borderRadius: 7,
          background: active ? "#eff6ff" : "#fff",
          padding: 10,
          cursor: "pointer",
          color: "#0f172a"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 900, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {contractDisplayTitle(record)}
          </div>
          <span style={statusStyle(record.status)}>{contractStatusLabel(record.status)}</span>
        </div>
        <div style={{ marginTop: 5, fontSize: 11, color: "#64748b" }}>
          {contractTypeLabel(record)} · {record.counterparty || "상대방 미입력"}
        </div>
        <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#475569" }}>
          <span>{record.contractNumber || "계약번호 미입력"}</span>
          <span>{record.recordType === "parent" ? `개별계약 ${childCount}건` : (linkedParent ? `모계약: ${contractDisplayTitle(linkedParent)}` : "모계약 미연결")}</span>
        </div>
      </button>
    );
  };

  const activeForm = isEditing ? draft : selectedRecord;
  const linkedProject = activeForm ? projectsById.get(String(activeForm.projectId)) : null;
  const linkedSupplyItem = activeForm ? supplyItemsById.get(String(activeForm.supplyItemId)) : null;
  const linkedParent = activeForm?.recordType === "child"
    ? parentRecords.find((parent) => String(parent.id) === String(activeForm.parentId))
    : null;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ ...panelStyle, padding: 14, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>계약 관리</div>
          <div style={{ marginTop: 3, fontSize: 12, color: "#64748b" }}>기본계약·포괄계약을 모계약으로 두고 개별계약과 NAS 계약서 경로를 함께 관리합니다.</div>
        </div>
        <div style={{ textAlign: "right", display: "grid", gap: 7, justifyItems: "end" }}>
          <div style={{ fontSize: 11, color: syncState?.status === "warning" ? "#b45309" : "#047857", fontWeight: 800 }}>{syncState?.message || ""}</div>
          {isAdmin && <div style={{ display: "flex", gap: 7 }}>
            <button type="button" onClick={() => beginAdd("parent")} style={subtleButton}>+ 모계약 추가</button>
            <button type="button" onClick={() => beginAdd("child")} style={primaryButton}>+ 하위 계약·문서 추가</button>
          </div>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(150px, 1fr))", gap: 8 }}>
        {[
          ["모계약", parentRecords.length],
          ["하위 계약·문서", normalizedRecords.filter((record) => record.recordType === "child").length],
          ["유효 계약", normalizedRecords.filter((record) => record.status === "active").length],
          ["90일 내 만료", expiringCount]
        ].map(([label, value]) => (
          <div key={label} style={{ ...panelStyle, padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800 }}>{label}</div>
            <div style={{ marginTop: 5, fontSize: 22, color: "#0f172a", fontWeight: 900 }}>{value}건</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "360px minmax(0, 1fr)", gap: 12, alignItems: "start" }}>
        <div style={{ ...panelStyle, overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "grid", gap: 8 }}>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="계약명, 상대방, 계약번호, NAS 경로 검색" style={inputStyle} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              <select value={recordFilter} onChange={(event) => setRecordFilter(event.target.value)} style={inputStyle}>
                <option value="all">전체 계약</option>
                <option value="parent">모계약</option>
                <option value="child">하위 계약·문서</option>
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={inputStyle}>
                <option value="all">전체 상태</option>
                {CONTRACT_STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ maxHeight: "calc(100vh - 330px)", overflowY: "auto", padding: 9, display: "grid", gap: 7 }}>
            {filteredRecords.map(renderRecordRow)}
            {filteredRecords.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>조건에 맞는 계약이 없습니다.</div>}
          </div>
        </div>

        <div style={{ ...panelStyle, overflow: "hidden", minHeight: 420 }}>
          {!activeForm ? (
            <div style={{ padding: 60, color: "#94a3b8", textAlign: "center", fontSize: 13 }}>왼쪽에서 계약을 선택하거나 새 계약을 추가해주세요.</div>
          ) : (
            <>
              <div style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", background: activeForm.recordType === "parent" ? "#e0f2fe" : "#eef2ff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 16, color: "#0f172a", fontWeight: 900 }}>{isEditing ? (selectedRecord ? "계약 수정" : "계약 등록") : contractDisplayTitle(activeForm)}</div>
                  <div style={{ marginTop: 3, fontSize: 11, color: "#64748b" }}>{contractTypeLabel(activeForm)} · {contractStatusLabel(activeForm.status)}</div>
                </div>
                <div style={{ display: "flex", gap: 7 }}>
                  {isEditing ? <>
                    <button type="button" onClick={saveDraft} style={primaryButton}>저장</button>
                    <button type="button" onClick={cancelEdit} style={subtleButton}>취소</button>
                    {selectedRecord && <button type="button" onClick={requestDelete} style={{ ...subtleButton, color: "#dc2626", borderColor: "#fecaca" }}>삭제</button>}
                  </> : isAdmin && <button type="button" onClick={beginEdit} style={subtleButton}>수정</button>}
                </div>
              </div>

              {isEditing ? (
                <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 11 }}>
                  <Field label="계약 구분">
                    <select
                      value={draft.recordType}
                      onChange={(event) => {
                        const recordType = event.target.value;
                        setDraft((previous) => normalizeContractRecord({
                          ...previous,
                          recordType,
                          parentId: recordType === "child" ? (previous.parentId || parentRecords[0]?.id || "") : ""
                        }));
                      }}
                      style={inputStyle}
                    >
                      <option value="parent">모계약</option>
                      <option value="child">하위 계약·문서</option>
                    </select>
                  </Field>
                  <Field label={draft.recordType === "parent" ? "모계약 유형" : "하위 문서 유형"}>
                    {draft.recordType === "parent" ? (
                      <select value={draft.parentContractType} onChange={(event) => setDraft((previous) => ({ ...previous, parentContractType: event.target.value }))} style={inputStyle}>
                        {PARENT_CONTRACT_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                      </select>
                    ) : (
                      <select value={draft.childContractType} onChange={(event) => setDraft((previous) => ({ ...previous, childContractType: event.target.value }))} style={inputStyle}>
                        {CHILD_CONTRACT_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                      </select>
                    )}
                  </Field>
                  <Field label="계약 상태">
                    <select value={draft.status} onChange={(event) => setDraft((previous) => ({ ...previous, status: event.target.value }))} style={inputStyle}>
                      {CONTRACT_STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
                    </select>
                  </Field>
                  <Field label="계약번호">
                    <input value={draft.contractNumber} onChange={(event) => setDraft((previous) => ({ ...previous, contractNumber: event.target.value }))} style={inputStyle} placeholder="사내 계약번호" />
                  </Field>
                  <Field label="계약명" span={2}>
                    <input value={draft.title} onChange={(event) => setDraft((previous) => ({ ...previous, title: event.target.value }))} style={inputStyle} placeholder="계약명" />
                  </Field>
                  <Field label="계약 상대방" span={2}>
                    <input value={draft.counterparty} onChange={(event) => setDraft((previous) => ({ ...previous, counterparty: event.target.value }))} style={inputStyle} placeholder="법인명 또는 상대방명" />
                  </Field>
                  {draft.recordType === "child" && <>
                    <Field label="연결 모계약" span={2}>
                      <select value={draft.parentId} onChange={(event) => setDraft((previous) => ({ ...previous, parentId: event.target.value }))} style={inputStyle}>
                        <option value="">모계약 선택</option>
                        {parentRecords.filter((record) => String(record.id) !== String(draft.id)).map((parent) => (
                          <option key={parent.id} value={parent.id}>{contractDisplayTitle(parent)} · {parent.counterparty}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="연결 제품개발 프로젝트">
                      <select value={draft.projectId} onChange={(event) => setDraft((previous) => ({ ...previous, projectId: event.target.value }))} style={inputStyle}>
                        <option value="">연결 안 함</option>
                        {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                      </select>
                    </Field>
                    <Field label="연결 공급단가 건">
                      <select value={draft.supplyItemId} onChange={(event) => setDraft((previous) => ({ ...previous, supplyItemId: event.target.value }))} style={inputStyle}>
                        <option value="">연결 안 함</option>
                        {supplyPriceItems.map((item) => <option key={item.id} value={item.id}>{supplyItemLabel(item)}</option>)}
                      </select>
                    </Field>
                  </>}
                  <Field label="체결일"><SegmentedDateInput value={draft.signedDate} onChange={(value) => setDraft((previous) => ({ ...previous, signedDate: value }))} style={inputStyle} /></Field>
                  <Field label="계약 시작일"><SegmentedDateInput value={draft.effectiveDate} onChange={(value) => setDraft((previous) => ({ ...previous, effectiveDate: value }))} style={inputStyle} /></Field>
                  <Field label="계약 종료일"><SegmentedDateInput value={draft.expirationDate} onChange={(value) => setDraft((previous) => ({ ...previous, expirationDate: value }))} style={inputStyle} /></Field>
                  <Field label="갱신 사전 통보기한(일)">
                    <input type="number" min="0" value={draft.renewalNoticeDays} onChange={(event) => setDraft((previous) => ({ ...previous, renewalNoticeDays: event.target.value }))} style={inputStyle} />
                  </Field>
                  <Field label="자동연장">
                    <label style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input type="checkbox" checked={draft.autoRenewal} onChange={(event) => setDraft((previous) => ({ ...previous, autoRenewal: event.target.checked }))} />
                      자동연장 조항 있음
                    </label>
                  </Field>
                  <Field label="계약금액">
                    <input value={draft.contractAmount} onChange={(event) => setDraft((previous) => ({ ...previous, contractAmount: event.target.value }))} style={inputStyle} placeholder="예: 연 30,000,000원" />
                  </Field>
                  <Field label="지급조건" span={2}>
                    <input value={draft.paymentTerms} onChange={(event) => setDraft((previous) => ({ ...previous, paymentTerms: event.target.value }))} style={inputStyle} placeholder="예: 월말 마감 후 익월 30일" />
                  </Field>
                  <Field label="NAS 계약서 경로" span={4}>
                    <input value={draft.nasPath} onChange={(event) => setDraft((previous) => ({ ...previous, nasPath: event.target.value }))} style={inputStyle} placeholder="예: \\NAS\계약서\2026\계약서.pdf" />
                  </Field>
                  <Field label="핵심 계약조건" span={2}>
                    <textarea rows={5} value={draft.keyTerms} onChange={(event) => setDraft((previous) => ({ ...previous, keyTerms: event.target.value }))} style={{ ...inputStyle, resize: "vertical" }} placeholder="독점, 최소주문수량, 해지조건 등 핵심 조항" />
                  </Field>
                  <Field label="비고" span={2}>
                    <textarea rows={5} value={draft.memo} onChange={(event) => setDraft((previous) => ({ ...previous, memo: event.target.value }))} style={{ ...inputStyle, resize: "vertical" }} />
                  </Field>
                </div>
              ) : (
                <div style={{ padding: 14, display: "grid", gap: 13 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 0, border: "1px solid #dbe3ee", borderRadius: 7, overflow: "hidden" }}>
                    {[
                      ["계약번호", activeForm.contractNumber],
                      ["계약 상대방", activeForm.counterparty],
                      ["체결일", activeForm.signedDate],
                      ["계약기간", [activeForm.effectiveDate, activeForm.expirationDate].filter(Boolean).join(" ~ ")],
                      ["계약금액", activeForm.contractAmount],
                      ["지급조건", activeForm.paymentTerms],
                      ["자동연장", activeForm.autoRenewal ? "있음" : "없음"],
                      ["갱신 통보기한", activeForm.renewalNoticeDays ? `${activeForm.renewalNoticeDays}일 전` : "-"]
                    ].map(([label, value], index) => (
                      <div key={label} style={{ padding: 11, borderRight: index % 4 !== 3 ? "1px solid #e2e8f0" : "none", borderBottom: index < 4 ? "1px solid #e2e8f0" : "none", minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, marginBottom: 5 }}>{label}</div>
                        <TextValue>{value}</TextValue>
                      </div>
                    ))}
                  </div>

                  {activeForm.recordType === "child" && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                      <div style={{ ...panelStyle, padding: 11 }}>
                        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, marginBottom: 5 }}>연결 모계약</div>
                        <TextValue>{linkedParent ? contractDisplayTitle(linkedParent) : "-"}</TextValue>
                      </div>
                      <div style={{ ...panelStyle, padding: 11 }}>
                        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, marginBottom: 5 }}>연결 제품개발 프로젝트</div>
                        <TextValue>{linkedProject?.name}</TextValue>
                      </div>
                      <div style={{ ...panelStyle, padding: 11 }}>
                        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, marginBottom: 5 }}>연결 공급단가 건</div>
                        <TextValue>{linkedSupplyItem ? supplyItemLabel(linkedSupplyItem) : "-"}</TextValue>
                      </div>
                    </div>
                  )}

                  <div style={{ ...panelStyle, padding: 12, background: "#f8fafc" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ fontSize: 12, color: "#334155", fontWeight: 900 }}>NAS 계약서 경로</div>
                      {activeForm.nasPath && <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" onClick={() => copyNasPath(activeForm.nasPath)} style={subtleButton}>경로 복사</button>
                        <button type="button" onClick={() => openNasPath(activeForm.nasPath)} style={primaryButton}>NAS 열기</button>
                      </div>}
                    </div>
                    <TextValue>{activeForm.nasPath}</TextValue>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ ...panelStyle, padding: 12 }}>
                      <div style={{ fontSize: 12, color: "#334155", fontWeight: 900, marginBottom: 6 }}>핵심 계약조건</div>
                      <TextValue>{activeForm.keyTerms}</TextValue>
                    </div>
                    <div style={{ ...panelStyle, padding: 12 }}>
                      <div style={{ fontSize: 12, color: "#334155", fontWeight: 900, marginBottom: 6 }}>비고</div>
                      <TextValue>{activeForm.memo}</TextValue>
                    </div>
                  </div>

                  {activeForm.recordType === "parent" && (
                    <div style={{ ...panelStyle, overflow: "hidden" }}>
                      <div style={{ padding: "9px 11px", background: "#f1f5f9", borderBottom: "1px solid #dbe3ee", fontSize: 12, fontWeight: 900 }}>
                        연결된 하위 계약·문서 {(childrenByParent.get(String(activeForm.id)) || []).length}건
                      </div>
                      <div style={{ display: "grid" }}>
                        {(childrenByParent.get(String(activeForm.id)) || []).map((child) => (
                          <button key={child.id} type="button" onClick={() => setSelectedId(child.id)} style={{ border: 0, borderBottom: "1px solid #eef2f7", background: "#fff", padding: "9px 11px", textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 800 }}>{contractDisplayTitle(child)}</span>
                            <span style={{ fontSize: 11, color: "#64748b" }}>{contractTypeLabel(child)} · {contractStatusLabel(child.status)}</span>
                          </button>
                        ))}
                        {(childrenByParent.get(String(activeForm.id)) || []).length === 0 && <div style={{ padding: 14, color: "#94a3b8", fontSize: 12 }}>연결된 하위 계약·문서가 없습니다.</div>}
                      </div>
                    </div>
                  )}
                  <div style={{ color: "#94a3b8", fontSize: 11, textAlign: "right" }}>최근 수정 {activeForm.updatedAt ? new Date(activeForm.updatedAt).toLocaleString() : "-"}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,23,42,.58)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "min(460px, 100%)", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, padding: 18, boxShadow: "0 20px 55px rgba(15,23,42,.28)" }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>계약 삭제 확인</div>
            <div style={{ marginTop: 8, color: "#475569", fontSize: 13, lineHeight: 1.6 }}>
              ‘{contractDisplayTitle(deleteTarget)}’ 계약을 정말 삭제하시겠습니까?<br />
              아래 입력창에 <strong>삭제합니다</strong>를 입력하세요.
            </div>
            <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoFocus style={{ ...inputStyle, marginTop: 12 }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 7, marginTop: 13 }}>
              <button type="button" onClick={() => { setDeleteTarget(null); setDeleteConfirmation(""); }} style={subtleButton}>취소</button>
              <button type="button" onClick={deleteRecord} disabled={deleteConfirmation !== "삭제합니다"} style={{ ...primaryButton, background: "#dc2626", borderColor: "#dc2626", opacity: deleteConfirmation === "삭제합니다" ? 1 : .45 }}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
