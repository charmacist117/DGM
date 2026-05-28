"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORIES,
  PHASES,
  STATUS_COLOR,
  STATUS_LABEL,
  getDefaultDevelopSubTimeline,
  getInitialProjects
} from "@/lib/pms/defaults";
import { TODAY, addDays, diff, fmt, toStr } from "@/lib/pms/date";
import { applyDelay, applyDurationChange, calcSchedule } from "@/lib/pms/schedule";
import { downloadFile, toCsv } from "@/lib/pms/exporters";

const LOCAL_CACHE_KEY = "pharmadev_pms_cache_v2";
const DEVELOP_TASK_ID = "develop";
const MERGED_SAMPLE_QUALITY_TASK_ID = "sample_quality";
const LEGACY_SAMPLE_TASK_ID = "sample";
const LEGACY_QUALITY_TASK_ID = "quality";

const PHASE_TEMPLATE_BY_ID = Object.fromEntries(PHASES.map((phase) => [phase.id, phase]));
const PHASE_ID_SET = new Set(PHASES.map((phase) => phase.id));

const tabButtonStyle = (active) => ({
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid " + (active ? "#7c3aed" : "#e2e8f0"),
  background: active ? "#faf5ff" : "#fff",
  color: active ? "#6d28d9" : "#475569",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700
});

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#fff",
  fontSize: 13
};

const primaryButton = {
  padding: "9px 12px",
  borderRadius: 8,
  border: "none",
  background: "#0f172a",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700
};

const subtleButton = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#475569",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 12
};

function toPositiveInt(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.round(n));
}

function normalizePredList(pred = []) {
  return [...new Set((pred || []).map((p) => {
    if (p === LEGACY_SAMPLE_TASK_ID || p === LEGACY_QUALITY_TASK_ID) return MERGED_SAMPLE_QUALITY_TASK_ID;
    return p;
  }))];
}

function mergeLegacySampleQualityTask(tasks) {
  const sample = tasks.find((t) => t.id === LEGACY_SAMPLE_TASK_ID);
  const quality = tasks.find((t) => t.id === LEGACY_QUALITY_TASK_ID);
  const alreadyMerged = tasks.find((t) => t.id === MERGED_SAMPLE_QUALITY_TASK_ID);

  if ((!sample && !quality) || alreadyMerged) return { tasks, migrated: false };

  const template = PHASE_TEMPLATE_BY_ID[MERGED_SAMPLE_QUALITY_TASK_ID];
  const existingCount = (sample ? 1 : 0) + (quality ? 1 : 0);
  const progressSum = (sample?.progress || 0) + (quality?.progress || 0);
  const mergedDuration = (sample?.duration || 0) + (quality?.duration || 0);
  const mergedNotes = [sample?.notes, quality?.notes].filter(Boolean).join(" / ");

  const mergedTask = {
    ...template,
    duration: mergedDuration > 0 ? mergedDuration : template.duration,
    progress: existingCount > 0 ? Math.round(progressSum / existingCount) : 0,
    taskStatus: quality?.taskStatus || sample?.taskStatus || "pending",
    notes: mergedNotes,
    scheduledStart: sample?.scheduledStart || quality?.scheduledStart,
    scheduledEnd: quality?.scheduledEnd || sample?.scheduledEnd,
    originalStart: sample?.originalStart || quality?.originalStart,
    originalEnd: quality?.originalEnd || sample?.originalEnd
  };

  return {
    tasks: [...tasks.filter((t) => t.id !== LEGACY_SAMPLE_TASK_ID && t.id !== LEGACY_QUALITY_TASK_ID), mergedTask],
    migrated: true
  };
}

function clampSubTimelineItem(item, developDuration) {
  const total = Math.max(1, toPositiveInt(developDuration, 1));
  const maxStart = Math.max(0, total - 1);
  const startOffset = Math.max(0, Math.min(Number(item.startOffset) || 0, maxStart));
  const maxDuration = Math.max(1, total - startOffset);
  const duration = Math.max(1, Math.min(Number(item.duration) || 1, maxDuration));

  return {
    ...item,
    startOffset,
    duration
  };
}

function normalizeDevelopSubTimeline(rawTimeline, developDuration) {
  const defaults = getDefaultDevelopSubTimeline();
  const rawMap = new Map((rawTimeline || []).map((item) => [item.id, item]));

  return defaults.map((base) => {
    const raw = rawMap.get(base.id);
    return clampSubTimelineItem(
      {
        ...base,
        ...(raw || {}),
        id: base.id,
        name: base.name
      },
      developDuration
    );
  });
}

function normalizeProject(project) {
  const sourceTasks = Array.isArray(project.tasks) ? project.tasks.map((task) => ({ ...task, pred: [...(task.pred || [])] })) : [];
  const mergedResult = mergeLegacySampleQualityTask(sourceTasks);
  const migratedFromLegacy = mergedResult.migrated;
  const normalizedSourceTasks = mergedResult.tasks.map((task) => ({
    ...task,
    pred: normalizePredList(task.pred || [])
  }));

  const byId = Object.fromEntries(normalizedSourceTasks.map((task) => [task.id, task]));
  let structureChanged = migratedFromLegacy;
  const orderedPhaseTasks = PHASES.map((template) => {
    const existing = byId[template.id];
    if (!existing) structureChanged = true;

    const duration = toPositiveInt(existing?.duration, template.duration);
    const task = {
      ...template,
      ...(existing || {}),
      id: template.id,
      name: existing?.name || template.name,
      cat: template.cat,
      icon: template.icon,
      color: template.color,
      duration,
      pred: normalizePredList(existing?.pred || template.pred),
      progress: Math.max(0, Math.min(100, Number(existing?.progress || 0))),
      taskStatus: existing?.taskStatus || "pending",
      notes: existing?.notes || ""
    };
    return task;
  });

  const extraTasks = normalizedSourceTasks.filter((task) => !PHASE_ID_SET.has(task.id));
  const finalTasks = [...orderedPhaseTasks, ...extraTasks];

  const hasMissingSchedule = orderedPhaseTasks.some((task) => !task.scheduledStart || !task.scheduledEnd || !task.originalStart || !task.originalEnd);
  const startDate = project.start || TODAY;

  let phaseTasksWithSchedule = orderedPhaseTasks;
  if (structureChanged || hasMissingSchedule) {
    const schedule = calcSchedule(orderedPhaseTasks, startDate);
    phaseTasksWithSchedule = orderedPhaseTasks.map((task) => ({
      ...task,
      scheduledStart: schedule[task.id].start,
      scheduledEnd: schedule[task.id].end,
      originalStart: task.originalStart || schedule[task.id].start,
      originalEnd: task.originalEnd || schedule[task.id].end
    }));
  }

  const phaseTaskMap = Object.fromEntries(phaseTasksWithSchedule.map((task) => [task.id, task]));
  const finalOrderedTasks = PHASES.map((template) => phaseTaskMap[template.id]);
  const developTask = phaseTaskMap[DEVELOP_TASK_ID] || PHASE_TEMPLATE_BY_ID[DEVELOP_TASK_ID];
  const developSubTimeline = normalizeDevelopSubTimeline(project.developSubTimeline, developTask.duration);

  return {
    ...project,
    manager: project.manager || "담당자",
    category: project.category || "건강기능식품",
    start: startDate,
    tasks: [...finalOrderedTasks, ...extraTasks],
    developSubTimeline,
    communicationLog: Array.isArray(project.communicationLog) ? project.communicationLog : [],
    decisionLog: Array.isArray(project.decisionLog) ? project.decisionLog : [],
    changeLog: Array.isArray(project.changeLog) ? project.changeLog : []
  };
}

function normalizeProjects(projects) {
  return (projects || []).map(normalizeProject);
}

function errorMessage(error, fallback = "알 수 없는 오류") {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || fallback;
  return String(error?.message || error || fallback);
}

function useProjectsStore() {
  const [projects, setProjects] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const cached = window.localStorage.getItem(LOCAL_CACHE_KEY);
      if (!cached) return [];
      return normalizeProjects(JSON.parse(cached));
    } catch {
      return [];
    }
  });

  const [syncState, setSyncState] = useState({ status: "loading", message: "서버 데이터 확인 중..." });
  const readyRef = useRef(false);
  const serverAvailableRef = useRef(false);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    let disposed = false;

    async function bootstrap() {
      try {
        const response = await fetch("/api/projects", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || payload.message || `서버 오류 (${response.status})`);
        }

        if (!disposed) {
          const nextProjects = normalizeProjects(Array.isArray(payload.projects) ? payload.projects : []);
          setProjects(nextProjects);
          serverAvailableRef.current = true;
          setSyncState({
            status: "ready",
            message: `서버 기준 데이터 로드 완료 (${payload.source === "seeded" ? "초기 생성" : "기존 데이터"})`
          });
          readyRef.current = true;
        }
      } catch (error) {
        const reason = errorMessage(error, "서버 연결 실패");
        if (!disposed) {
          const fallbackProjects = normalizeProjects(getInitialProjects());
          setProjects((prev) => (prev.length ? normalizeProjects(prev) : fallbackProjects));
          serverAvailableRef.current = false;
          setSyncState({
            status: "warning",
            message: `${reason}: 로컬 캐시 모드로 동작합니다.`
          });
          readyRef.current = true;
        }
      }
    }

    bootstrap();
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!readyRef.current) return;

    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(projects));
    }

    if (!serverAvailableRef.current) {
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        setSyncState({ status: "saving", message: "서버 저장 중..." });
        const response = await fetch("/api/projects", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projects })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || payload.message || `저장 실패 (${response.status})`);
        }
        setSyncState({ status: "saved", message: `저장 완료 (${new Date(payload.updatedAt).toLocaleString()})` });
      } catch (error) {
        serverAvailableRef.current = false;
        setSyncState({
          status: "warning",
          message: `서버 저장 실패 (${errorMessage(error, "원인 확인 필요")}): 로컬 캐시에만 저장됨`
        });
      }
    }, 700);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [projects]);

  return { projects, setProjects, syncState };
}

function SyncBadge({ syncState }) {
  const colorMap = {
    loading: "#64748b",
    ready: "#0ea5e9",
    saving: "#f59e0b",
    saved: "#10b981",
    warning: "#ef4444"
  };
  return (
    <div style={{ fontSize: 11, color: colorMap[syncState.status] || "#64748b", fontWeight: 700 }}>
      {syncState.message}
    </div>
  );
}

function TaskEditModal({ task, onClose, onSave }) {
  const [progress, setProgress] = useState(task.progress || 0);
  const [taskStatus, setTaskStatus] = useState(task.taskStatus || "pending");
  const [notes, setNotes] = useState(task.notes || "");
  const [delayDays, setDelayDays] = useState(0);
  const [duration, setDuration] = useState(task.duration || 1);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 520, borderRadius: 14, background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,.2)", padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{task.icon} {task.name}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 19 }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: "#475569", background: "#f8fafc", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
          일정: {fmt(task.scheduledStart)} ~ {fmt(task.scheduledEnd)} ({task.duration}일)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700 }}>진행률 ({progress}%)</label>
            <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>상태</label>
            <select value={taskStatus} onChange={(e) => setTaskStatus(e.target.value)} style={inputStyle}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>지연 적용 (일)</label>
            <input type="number" value={delayDays} min={0} onChange={(e) => setDelayDays(Number(e.target.value))} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>기간 변경 (일)</label>
            <input type="number" value={duration} min={1} onChange={(e) => setDuration(Number(e.target.value))} style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>메모</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer" }}>취소</button>
          <button
            onClick={() => onSave({ progress, taskStatus, notes, delayDays, duration: toPositiveInt(duration, task.duration || 1) })}
            style={{ ...primaryButton, flex: 2 }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ project }) {
  const launch = project.tasks[project.tasks.length - 1];
  const completedCount = project.tasks.filter((t) => t.taskStatus === "completed").length;
  const delayedCount = project.tasks.filter((t) => t.taskStatus === "delayed").length;
  const progressAvg = Math.round(project.tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / Math.max(project.tasks.length, 1));
  const dDay = diff(TODAY, launch?.scheduledEnd || TODAY);

  const cardStyle = { borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0", padding: 14 };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(120px,1fr))", gap: 12 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>총 진행률</div>
          <div style={{ fontSize: 23, fontWeight: 900, color: "#7c3aed" }}>{progressAvg}%</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>목표 출시일</div>
          <div style={{ fontSize: 23, fontWeight: 900, color: "#0f172a" }}>{fmt(launch?.scheduledEnd)}</div>
          <div style={{ fontSize: 11, color: dDay < 0 ? "#ef4444" : "#10b981", fontWeight: 700 }}>{dDay >= 0 ? `D-${dDay}` : `D+${Math.abs(dDay)} 지연`}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>완료 태스크</div>
          <div style={{ fontSize: 23, fontWeight: 900, color: "#059669" }}>{completedCount}/{project.tasks.length}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>지연 태스크</div>
          <div style={{ fontSize: 23, fontWeight: 900, color: delayedCount > 0 ? "#ef4444" : "#10b981" }}>{delayedCount}</div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "11px 14px", borderBottom: "1px solid #e2e8f0", fontWeight: 800 }}>태스크 현황</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["태스크", "상태", "시작", "완료", "기간", "진행률"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontSize: 11, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {project.tasks.map((task) => (
              <tr key={task.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "9px 12px", fontSize: 13, fontWeight: 600 }}>{task.icon} {task.name}</td>
                <td style={{ padding: "9px 12px" }}>
                  <span style={{ color: STATUS_COLOR[task.taskStatus], fontSize: 11, fontWeight: 700, background: STATUS_COLOR[task.taskStatus] + "22", borderRadius: 999, padding: "3px 8px" }}>
                    {STATUS_LABEL[task.taskStatus]}
                  </span>
                </td>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>{fmt(task.scheduledStart)}</td>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>{fmt(task.scheduledEnd)}</td>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>{task.duration}일</td>
                <td style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700 }}>{task.progress || 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TasksTab({ project, onTaskSave, onDevelopSubTimelineUpdate }) {
  const [editTask, setEditTask] = useState(null);
  const developTask = project.tasks.find((task) => task.id === DEVELOP_TASK_ID);
  const developDuration = toPositiveInt(developTask?.duration, 1);
  const developTimeline = developTask
    ? normalizeDevelopSubTimeline(project.developSubTimeline, developDuration)
    : [];

  const saveDevelopItem = (itemId, field, value) => {
    if (!developTask) return;
    const numeric = Number(value);
    const raw = developTimeline.map((item) => (
      item.id === itemId ? { ...item, [field]: Number.isFinite(numeric) ? numeric : item[field] } : item
    ));
    onDevelopSubTimelineUpdate(normalizeDevelopSubTimeline(raw, developDuration));
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", fontWeight: 800 }}>태스크 일정/진행 수정</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {["태스크", "시작", "완료", "상태", "진행률", "메모", ""].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontSize: 11, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {project.tasks.flatMap((task) => {
            const rows = [
              <tr key={task.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "9px 12px", fontSize: 13, fontWeight: 700 }}>{task.icon} {task.name}</td>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>{fmt(task.scheduledStart)}</td>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>{fmt(task.scheduledEnd)}</td>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>{STATUS_LABEL[task.taskStatus]}</td>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>{task.progress || 0}%</td>
                <td style={{ padding: "9px 12px", fontSize: 12, color: "#64748b", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.notes || "-"}</td>
                <td style={{ padding: "9px 12px" }}>
                  <button onClick={() => setEditTask(task)} style={{ padding: "6px 9px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 12 }}>
                    수정
                  </button>
                </td>
              </tr>
            ];

            if (task.id === DEVELOP_TASK_ID && developTask) {
              rows.push(
                <tr key={`${task.id}__subtimeline`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td colSpan={7} style={{ padding: "10px 12px 14px", background: "#f8fafc" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
                      제품 개발 부수 일정 (제품 개발 {developTask.duration}일 내)
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {developTimeline.map((item) => {
                        const itemStart = toStr(addDays(developTask.scheduledStart, item.startOffset));
                        const itemEnd = toStr(addDays(itemStart, item.duration));
                        const leftPct = (item.startOffset / developDuration) * 100;
                        const widthPct = (item.duration / developDuration) * 100;
                        return (
                          <div key={item.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", padding: 8 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "170px 100px 100px 1fr", gap: 8, alignItems: "center", marginBottom: 6 }}>
                              <div style={{ fontSize: 12, fontWeight: 700 }}>{item.name}</div>
                              <input
                                type="number"
                                min={0}
                                value={item.startOffset}
                                onChange={(event) => saveDevelopItem(item.id, "startOffset", event.target.value)}
                                style={{ ...inputStyle, fontSize: 12, padding: "5px 8px" }}
                                title="시작 오프셋(일)"
                              />
                              <input
                                type="number"
                                min={1}
                                value={item.duration}
                                onChange={(event) => saveDevelopItem(item.id, "duration", event.target.value)}
                                style={{ ...inputStyle, fontSize: 12, padding: "5px 8px" }}
                                title="기간(일)"
                              />
                              <div style={{ fontSize: 11, color: "#64748b" }}>{fmt(itemStart)} ~ {fmt(itemEnd)}</div>
                            </div>
                            <div style={{ position: "relative", height: 8, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                              <div style={{ position: "absolute", left: `${leftPct}%`, width: `${widthPct}%`, top: 0, bottom: 0, background: "#047857" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            }

            return rows;
          })}
        </tbody>
      </table>

      {editTask && (
        <TaskEditModal
          task={editTask}
          onClose={() => setEditTask(null)}
          onSave={(patch) => {
            onTaskSave(editTask, patch);
            setEditTask(null);
          }}
        />
      )}
    </div>
  );
}

function CommunicationTab({ project, onSaveLog }) {
  const [form, setForm] = useState({
    date: TODAY,
    company: "",
    contact: "",
    channel: "전화",
    summary: "",
    outcome: "",
    nextAction: ""
  });
  const logs = project.communicationLog || [];

  const save = () => {
    if (!form.company || !form.summary) {
      window.alert("업체명과 소통 내용을 입력하세요.");
      return;
    }
    onSaveLog({ ...form, id: Date.now() });
    setForm({ date: TODAY, company: "", contact: "", channel: "전화", summary: "", outcome: "", nextAction: "" });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14 }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>업체 소통 기록</div>
        <div style={{ display: "grid", gap: 8 }}>
          <input placeholder="업체명 *" value={form.company} onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))} style={inputStyle} />
          <input placeholder="담당자" value={form.contact} onChange={(e) => setForm((prev) => ({ ...prev, contact: e.target.value }))} style={inputStyle} />
          <input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} style={inputStyle} />
          <select value={form.channel} onChange={(e) => setForm((prev) => ({ ...prev, channel: e.target.value }))} style={inputStyle}>
            {["전화", "이메일", "미팅", "메신저", "방문", "기타"].map((value) => <option key={value}>{value}</option>)}
          </select>
          <textarea rows={3} placeholder="소통 내용 *" value={form.summary} onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))} style={{ ...inputStyle, resize: "vertical" }} />
          <textarea rows={2} placeholder="판단/결과 (예: A업체 제외, B업체 진행)" value={form.outcome} onChange={(e) => setForm((prev) => ({ ...prev, outcome: e.target.value }))} style={{ ...inputStyle, resize: "vertical" }} />
          <input placeholder="후속 조치" value={form.nextAction} onChange={(e) => setForm((prev) => ({ ...prev, nextAction: e.target.value }))} style={inputStyle} />
          <button onClick={save} style={primaryButton}>저장</button>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontWeight: 800 }}>소통 히스토리 ({logs.length}건)</div>
          <button
            onClick={() => {
              if (!logs.length) return window.alert("내보낼 데이터가 없습니다.");
              downloadFile(`${project.name}_communication.csv`, toCsv(logs), "text/csv;charset=utf-8;");
            }}
            style={subtleButton}
          >
            CSV 내보내기
          </button>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {[...logs].reverse().map((item) => (
            <div key={item.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontWeight: 800 }}>{item.company}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{fmt(item.date)} · {item.channel}</div>
              </div>
              <div style={{ fontSize: 13, marginBottom: 5 }}>{item.summary}</div>
              {item.outcome && <div style={{ fontSize: 12, color: "#0369a1", marginBottom: 3 }}>결과: {item.outcome}</div>}
              {item.nextAction && <div style={{ fontSize: 12, color: "#b45309" }}>후속: {item.nextAction}</div>}
            </div>
          ))}
          {logs.length === 0 && <div style={{ color: "#94a3b8", textAlign: "center", padding: 24 }}>기록이 없습니다.</div>}
        </div>
      </div>
    </div>
  );
}

function DecisionTab({ project, onSaveLog }) {
  const [form, setForm] = useState({
    date: TODAY,
    decider: "대표",
    title: "",
    impact: "보통",
    status: "의사결정 완료",
    description: ""
  });
  const logs = project.decisionLog || [];

  const save = () => {
    if (!form.title || !form.description) {
      window.alert("안건명과 의사결정 상세 내용을 입력하세요.");
      return;
    }
    onSaveLog({ ...form, id: Date.now() });
    setForm({ date: TODAY, decider: "대표", title: "", impact: "보통", status: "의사결정 완료", description: "" });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14 }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>대표/부대표 의사결정 기록</div>
        <div style={{ display: "grid", gap: 8 }}>
          <input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} style={inputStyle} />
          <select value={form.decider} onChange={(e) => setForm((prev) => ({ ...prev, decider: e.target.value }))} style={inputStyle}>
            {["대표", "부대표", "공동결정"].map((value) => <option key={value}>{value}</option>)}
          </select>
          <input placeholder="안건명 *" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} style={inputStyle} />
          <select value={form.impact} onChange={(e) => setForm((prev) => ({ ...prev, impact: e.target.value }))} style={inputStyle}>
            {["낮음", "보통", "높음", "크리티컬"].map((value) => <option key={value}>{value}</option>)}
          </select>
          <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} style={inputStyle}>
            {["검토중", "의사결정 완료", "보류"].map((value) => <option key={value}>{value}</option>)}
          </select>
          <textarea rows={5} placeholder="의사결정 배경/결론/조건 *" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} style={{ ...inputStyle, resize: "vertical" }} />
          <button onClick={save} style={primaryButton}>저장</button>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontWeight: 800 }}>의사결정 아카이브 ({logs.length}건)</div>
          <button
            onClick={() => {
              if (!logs.length) return window.alert("내보낼 데이터가 없습니다.");
              downloadFile(`${project.name}_decisions.csv`, toCsv(logs), "text/csv;charset=utf-8;");
            }}
            style={subtleButton}
          >
            CSV 내보내기
          </button>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {[...logs].reverse().map((item) => (
            <div key={item.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", overflow: "hidden" }}>
              <div style={{ padding: "8px 10px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 800 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{item.decider} · {fmt(item.date)}</div>
              </div>
              <div style={{ padding: 10, fontSize: 13, whiteSpace: "pre-wrap" }}>{item.description}</div>
            </div>
          ))}
          {logs.length === 0 && <div style={{ color: "#94a3b8", textAlign: "center", padding: 24 }}>기록이 없습니다.</div>}
        </div>
      </div>
    </div>
  );
}

function BackupTab({ projects, selectedProject, onRestore }) {
  const fileInputRef = useRef(null);

  const exportAllJson = () => {
    const content = JSON.stringify(projects, null, 2);
    downloadFile(`PharmaDev_backup_${toStr(new Date())}.json`, content, "application/json");
  };

  const exportProjectCsv = () => {
    const rows = selectedProject.tasks.map((task) => ({
      project: selectedProject.name,
      task: task.name,
      start: task.scheduledStart,
      end: task.scheduledEnd,
      duration: task.duration,
      progress: task.progress,
      status: task.taskStatus,
      notes: task.notes || ""
    }));
    downloadFile(`${selectedProject.name}_tasks.csv`, toCsv(rows), "text/csv;charset=utf-8;");
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>백업/복원</div>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 10 }}>
          서버 DB가 기본 저장소이며, 아래 파일 백업은 이중 안전장치입니다.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={exportAllJson} style={primaryButton}>전체 JSON 백업</button>
          <button onClick={exportProjectCsv} style={subtleButton}>현재 프로젝트 태스크 CSV</button>
          <button onClick={() => fileInputRef.current?.click()} style={subtleButton}>JSON 백업파일 불러오기</button>
        </div>
      </div>
      <input
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        ref={fileInputRef}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed)) throw new Error("프로젝트 배열 형식이 아닙니다.");
            onRestore(normalizeProjects(parsed));
            window.alert("백업 데이터 복원이 완료되었습니다.");
          } catch (error) {
            window.alert(`복원 실패: ${String(error.message || error)}`);
          } finally {
            event.target.value = "";
          }
        }}
      />
    </div>
  );
}

function ProjectMetaEditor({ project, onSave }) {
  const [manager, setManager] = useState(project.manager || "");
  const [category, setCategory] = useState(project.category || CATEGORIES[0]);
  const categoryOptions = CATEGORIES.includes(category) ? CATEGORIES : [category, ...CATEGORIES];

  useEffect(() => {
    setManager(project.manager || "");
    setCategory(project.category || CATEGORIES[0]);
  }, [project.id, project.manager, project.category]);

  const metaLogs = (project.changeLog || [])
    .filter((log) => log?.type === "project_meta")
    .slice()
    .reverse()
    .slice(0, 5);

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>프로젝트 기본정보 수정</div>
      <div style={{ display: "grid", gridTemplateColumns: "180px 180px auto", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input
          value={manager}
          onChange={(event) => setManager(event.target.value)}
          placeholder="담당자"
          style={inputStyle}
        />
        <select value={category} onChange={(event) => setCategory(event.target.value)} style={inputStyle}>
          {categoryOptions.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <button
          onClick={() => {
            const nextManager = manager.trim();
            if (!nextManager) {
              window.alert("담당자명을 입력하세요.");
              return;
            }
            onSave({ manager: nextManager, category });
          }}
          style={primaryButton}
        >
          저장
        </button>
      </div>

      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>최근 변경 이력</div>
      <div style={{ display: "grid", gap: 4 }}>
        {metaLogs.map((log) => (
          <div key={log.id} style={{ fontSize: 11, color: "#475569", background: "#f8fafc", borderRadius: 6, padding: "5px 8px" }}>
            {fmt(log.date)} · {log.reason}
          </div>
        ))}
        {metaLogs.length === 0 && (
          <div style={{ fontSize: 11, color: "#94a3b8", padding: "4px 2px" }}>변경 이력이 없습니다.</div>
        )}
      </div>
    </div>
  );
}

export default function PmsApp() {
  const { projects, setProjects, syncState } = useProjectsStore();
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    if (!projects.length) return;
    setSelectedId((prev) => (prev && projects.some((project) => project.id === prev) ? prev : projects[0].id));
  }, [projects]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedId),
    [projects, selectedId]
  );

  const updateProject = (projectId, updater) => {
    setProjects((prev) => normalizeProjects(prev.map((project) => (project.id === projectId ? updater(project) : project))));
  };

  const addProject = () => {
    const name = window.prompt("새 프로젝트명");
    if (!name) return;
    const manager = window.prompt("담당자명", "담당자");
    const category = window.prompt(`카테고리 (${CATEGORIES.join(", ")})`, "건강기능식품");
    const start = window.prompt("시작일 (YYYY-MM-DD)", TODAY);
    const id = Date.now();

    const templates = PHASES.map((task) => ({
      id: task.id,
      name: task.name,
      cat: task.cat,
      icon: task.icon,
      color: task.color,
      duration: task.duration,
      pred: [...task.pred]
    }));
    const schedule = calcSchedule(templates, start || TODAY);

    const newProject = normalizeProject({
      id,
      name,
      desc: "",
      manager: manager || "담당자",
      category: category || "건강기능식품",
      start: start || TODAY,
      permitCompany: "",
      manufacturer: "",
      tasks: templates.map((task) => ({
        ...task,
        scheduledStart: schedule[task.id].start,
        scheduledEnd: schedule[task.id].end,
        originalStart: schedule[task.id].start,
        originalEnd: schedule[task.id].end,
        progress: 0,
        taskStatus: "pending",
        notes: ""
      })),
      developSubTimeline: getDefaultDevelopSubTimeline(),
      communicationLog: [],
      decisionLog: [],
      contracts: [],
      changeLog: []
    });

    setProjects((prev) => [...prev, newProject]);
    setSelectedId(id);
    setTab("overview");
  };

  if (!selectedProject) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>프로젝트 로딩 중...</div>
        <SyncBadge syncState={syncState} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={{ width: 280, background: "#0f172a", color: "#fff", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ padding: "8px 10px" }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>PharmaDev PMS</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Vercel 영구저장형 운영 모드</div>
        </div>

        <button onClick={addProject} style={{ width: "100%", borderRadius: 8, padding: "8px 10px", border: "1px dashed #475569", background: "transparent", color: "#cbd5e1", cursor: "pointer", fontWeight: 700 }}>
          + 새 프로젝트
        </button>

        <div style={{ overflowY: "auto", display: "grid", gap: 6, paddingRight: 4 }}>
          {projects.map((project) => {
            const launch = project.tasks[project.tasks.length - 1];
            const dDay = diff(TODAY, launch?.scheduledEnd || TODAY);
            const active = project.id === selectedProject.id;
            return (
              <button
                key={project.id}
                onClick={() => setSelectedId(project.id)}
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
                  {project.category} · D-{dDay} · {project.manager}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <main style={{ flex: 1, padding: 16, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{selectedProject.name}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              담당: {selectedProject.manager} · 시작일: {fmt(selectedProject.start)} · 카테고리: {selectedProject.category}
            </div>
          </div>
          <SyncBadge syncState={syncState} />
        </div>

        <ProjectMetaEditor
          project={selectedProject}
          onSave={({ manager, category }) => {
            updateProject(selectedProject.id, (project) => {
              const nextManager = manager.trim();
              const nextCategory = category;
              if (project.manager === nextManager && project.category === nextCategory) return project;

              const historyParts = [];
              if (project.manager !== nextManager) historyParts.push(`담당자: ${project.manager} → ${nextManager}`);
              if (project.category !== nextCategory) historyParts.push(`카테고리: ${project.category} → ${nextCategory}`);

              return {
                ...project,
                manager: nextManager,
                category: nextCategory,
                changeLog: [
                  ...(project.changeLog || []),
                  {
                    id: Date.now(),
                    type: "project_meta",
                    taskId: "_project_meta",
                    taskName: "프로젝트 기본정보",
                    date: TODAY,
                    reason: historyParts.join(" / ")
                  }
                ]
              };
            });
          }}
        />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {[
            ["overview", "개요"],
            ["tasks", "태스크 관리"],
            ["communication", "업체 소통 기록"],
            ["decision", "의사결정 기록"],
            ["backup", "백업/복원"]
          ].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={tabButtonStyle(tab === id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab project={selectedProject} />}

        {tab === "tasks" && (
          <TasksTab
            project={selectedProject}
            onTaskSave={(task, patch) => {
              updateProject(selectedProject.id, (project) => {
                let tasks = project.tasks.map((currentTask) => (
                  currentTask.id === task.id
                    ? {
                        ...currentTask,
                        progress: patch.progress,
                        taskStatus: patch.taskStatus,
                        notes: patch.notes,
                        duration: patch.duration
                      }
                    : currentTask
                ));

                if (patch.delayDays > 0) tasks = applyDelay(tasks, task.id, patch.delayDays);
                if (patch.duration !== task.duration) tasks = applyDurationChange(tasks, task.id, patch.duration);

                const developTask = tasks.find((currentTask) => currentTask.id === DEVELOP_TASK_ID);
                const developSubTimeline = normalizeDevelopSubTimeline(
                  project.developSubTimeline,
                  developTask?.duration || 1
                );

                return {
                  ...project,
                  tasks,
                  developSubTimeline,
                  changeLog: [
                    ...(project.changeLog || []),
                    {
                      id: Date.now(),
                      taskId: task.id,
                      taskName: task.name,
                      date: TODAY,
                      reason: patch.notes || "수정",
                      delayDays: patch.delayDays,
                      duration: patch.duration
                    }
                  ]
                };
              });
            }}
            onDevelopSubTimelineUpdate={(nextTimeline) => {
              updateProject(selectedProject.id, (project) => ({
                ...project,
                developSubTimeline: nextTimeline,
                changeLog: [
                  ...(project.changeLog || []),
                  {
                    id: Date.now(),
                    taskId: DEVELOP_TASK_ID,
                    taskName: "제품 개발 부수 일정",
                    date: TODAY,
                    reason: "하위 구성요소 기간/위치 변경"
                  }
                ]
              }));
            }}
          />
        )}

        {tab === "communication" && (
          <CommunicationTab
            project={selectedProject}
            onSaveLog={(item) => {
              updateProject(selectedProject.id, (project) => ({
                ...project,
                communicationLog: [...(project.communicationLog || []), item]
              }));
            }}
          />
        )}

        {tab === "decision" && (
          <DecisionTab
            project={selectedProject}
            onSaveLog={(item) => {
              updateProject(selectedProject.id, (project) => ({
                ...project,
                decisionLog: [...(project.decisionLog || []), item]
              }));
            }}
          />
        )}

        {tab === "backup" && (
          <BackupTab
            projects={projects}
            selectedProject={selectedProject}
            onRestore={(nextProjects) => {
              setProjects(normalizeProjects(nextProjects));
              if (nextProjects.length > 0) setSelectedId(nextProjects[0].id);
            }}
          />
        )}
      </main>
    </div>
  );
}
