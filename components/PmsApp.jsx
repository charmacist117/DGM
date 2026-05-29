"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ProjectSidebar from "@/components/ProjectSidebar";
import {
  CATEGORIES,
  PHASES,
  STATUS_COLOR,
  STATUS_LABEL,
  getDefaultDevelopSubTimeline,
  getInitialProjects
} from "@/lib/pms/defaults";
import { TODAY, addDays, diff, fmt, toStr } from "@/lib/pms/date";
import { applyDelay, applyDurationChange, applyStartDateChange, calcSchedule } from "@/lib/pms/schedule";
import { downloadFile, toCsv } from "@/lib/pms/exporters";

const LOCAL_CACHE_KEY = "pharmadev_pms_cache_v2";
const DEVELOP_TASK_ID = "develop";
const MERGED_SAMPLE_QUALITY_TASK_ID = "sample_quality";
const LEGACY_SAMPLE_TASK_ID = "sample";
const LEGACY_QUALITY_TASK_ID = "quality";
const ROLE_ADMIN = "admin";
const ROLE_GUEST = "guest";

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

function formatOwners(project) {
  const pm = (project?.pmName || "").trim();
  const am = (project?.amName || "").trim();
  const chunks = [];
  if (pm) chunks.push(`PM ${pm}`);
  if (am) chunks.push(`AM ${am}`);
  if (chunks.length > 0) return chunks.join(" / ");
  return project?.manager || "誘몄젙";
}

function getCurrentStageTask(project) {
  const tasks = (project?.tasks || []).filter((task) => task.isEnabled !== false);
  if (tasks.length === 0) return null;

  const delayed = tasks.find((task) => task.taskStatus === "delayed" && task.taskStatus !== "completed");
  if (delayed) return delayed;

  const inProgress = tasks.find((task) => task.taskStatus === "in_progress");
  if (inProgress) return inProgress;

  const todayBased = tasks.find((task) => (
    task.taskStatus !== "completed" &&
    task.scheduledStart <= TODAY &&
    task.scheduledEnd >= TODAY
  ));
  if (todayBased) return todayBased;

  const upcoming = tasks.find((task) => task.taskStatus !== "completed" && task.scheduledEnd >= TODAY);
  if (upcoming) return upcoming;

  return tasks[tasks.length - 1] || null;
}

function buildStageReminderMessage(task) {
  if (!task) {
    return { text: "吏꾪뻾 以묒씤 ?④퀎瑜?李얠? 紐삵뻽?듬땲??", isLate: false };
  }
  const daysLeft = diff(TODAY, task.scheduledEnd || TODAY);
  if (daysLeft >= 0) {
    return {
      text: `?대떦 ?④퀎 ?꾨즺源뚯? ${daysLeft}???⑥븯?듬땲?? 臾몄젣?놁씠 吏꾪뻾?섍퀬 ?덈굹??`,
      isLate: false
    };
  }
  return {
    text: `?대떦 ?④퀎 ?꾨즺 ?덉젙?쇱씠 ${Math.abs(daysLeft)}??吏?ъ뒿?덈떎. 吏???ъ쑀瑜??뺤씤?댁＜?몄슂.`,
    isLate: true
  };
}

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
        name: base.name,
        enabled: raw?.enabled !== false
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
      isEnabled: existing?.isEnabled !== false,
      vendorName: existing?.vendorName || "",
      taskStatus: existing?.taskStatus || "pending",
      notes: existing?.notes || ""
    };
    return task;
  });

  const extraTasks = normalizedSourceTasks
    .filter((task) => !PHASE_ID_SET.has(task.id))
    .map((task) => ({
      ...task,
      isEnabled: task?.isEnabled !== false
    }));
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
    pmName: (project.pmName || "").trim(),
    amName: (project.amName || "").trim(),
    manager: project.manager || [project.pmName, project.amName].filter(Boolean).join(" / ") || "誘몄젙",
    category: project.category || "嫄닿컯湲곕뒫?앺뭹",
    start: startDate,
    tasks: [...finalOrderedTasks, ...extraTasks],
    developSubTimeline,
    communicationLog: Array.isArray(project.communicationLog) ? project.communicationLog : [],
    decisionLog: Array.isArray(project.decisionLog) ? project.decisionLog : [],
    advisorLog: Array.isArray(project.advisorLog) ? project.advisorLog : [],
    stageCheckLog: Array.isArray(project.stageCheckLog) ? project.stageCheckLog : [],
    changeLog: Array.isArray(project.changeLog) ? project.changeLog : []
  };
}

function normalizeProjects(projects) {
  return (projects || []).map(normalizeProject);
}

function normalizeAdminLogs(logs) {
  return (logs || [])
    .filter((log) => log && typeof log === "object")
    .map((log) => ({
      id: log.id || Date.now() + Math.floor(Math.random() * 1000),
      type: log.type || "project_event",
      projectId: log.projectId ?? null,
      projectName: log.projectName || "-",
      reason: log.reason || "",
      actor: log.actor || "愿由ъ옄",
      createdAt: log.createdAt || new Date().toISOString(),
      hiddenForManager: Boolean(log.hiddenForManager)
    }));
}

function canManage(role) {
  return role === ROLE_ADMIN;
}

function errorMessage(error, fallback = "?????녿뒗 ?ㅻ쪟") {
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
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return normalizeProjects(parsed);
      return normalizeProjects(Array.isArray(parsed?.projects) ? parsed.projects : []);
    } catch {
      return [];
    }
  });

  const [adminLogs, setAdminLogs] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const cached = window.localStorage.getItem(LOCAL_CACHE_KEY);
      if (!cached) return [];
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return [];
      return normalizeAdminLogs(Array.isArray(parsed?.adminLogs) ? parsed.adminLogs : []);
    } catch {
      return [];
    }
  });

  const [syncState, setSyncState] = useState({ status: "loading", message: "?쒕쾭 ?곗씠???뺤씤 以?.." });
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
          throw new Error(payload.error || payload.message || `?쒕쾭 ?ㅻ쪟 (${response.status})`);
        }

        if (!disposed) {
          const nextProjects = normalizeProjects(Array.isArray(payload.projects) ? payload.projects : []);
          const nextAdminLogs = normalizeAdminLogs(Array.isArray(payload.adminLogs) ? payload.adminLogs : []);
          setProjects(nextProjects);
          setAdminLogs(nextAdminLogs);
          serverAvailableRef.current = true;
          setSyncState({
            status: "ready",
            message: payload.source === "seeded" ? "서버 초기 데이터 로드 완료" : "서버 기존 데이터 로드 완료"
          });
          readyRef.current = true;
        }
      } catch (error) {
        const reason = errorMessage(error, "?쒕쾭 ?곌껐 ?ㅽ뙣");
        if (!disposed) {
          const fallbackProjects = normalizeProjects(getInitialProjects());
          setProjects((prev) => (prev.length ? normalizeProjects(prev) : fallbackProjects));
          setAdminLogs((prev) => normalizeAdminLogs(prev));
          serverAvailableRef.current = false;
          setSyncState({
            status: "warning",
            message: `${reason}: 濡쒖뺄 罹먯떆 紐⑤뱶濡??숈옉?⑸땲??`
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
      window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({ projects, adminLogs }));
    }

    if (!serverAvailableRef.current) {
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        setSyncState({ status: "saving", message: "?쒕쾭 ???以?.." });
        const response = await fetch("/api/projects", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projects, adminLogs })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || payload.message || `????ㅽ뙣 (${response.status})`);
        }
        setSyncState({ status: "saved", message: `????꾨즺 (${new Date(payload.updatedAt).toLocaleString()})` });
      } catch (error) {
        serverAvailableRef.current = false;
        setSyncState({
          status: "warning",
          message: `?쒕쾭 ????ㅽ뙣 (${errorMessage(error, "?먯씤 ?뺤씤 ?꾩슂")}): 濡쒖뺄 罹먯떆?먮쭔 ??λ맖`
        });
      }
    }, 700);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [projects, adminLogs]);

  return { projects, setProjects, adminLogs, setAdminLogs, syncState };
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
  const [startDate, setStartDate] = useState(task.scheduledStart || TODAY);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 520, borderRadius: 14, background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,.2)", padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{task.icon} {task.name}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 19 }}>??</button>
        </div>
        <div style={{ fontSize: 12, color: "#475569", background: "#f8fafc", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
          ?쇱젙: {fmt(task.scheduledStart)} ~ {fmt(task.scheduledEnd)} ({task.duration}??
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700 }}>吏꾪뻾瑜?({progress}%)</label>
            <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>?곹깭</label>
            <select value={taskStatus} onChange={(e) => setTaskStatus(e.target.value)} style={inputStyle}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>吏???곸슜 (??</label>
            <input type="number" value={delayDays} min={0} onChange={(e) => setDelayDays(Number(e.target.value))} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>湲곌컙 蹂寃?(??</label>
            <input type="number" value={duration} min={1} onChange={(e) => setDuration(Number(e.target.value))} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>?쒖옉??吏??</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>硫붾え</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer" }}>痍⑥냼</button>
          <button
            onClick={() => onSave({
              progress,
              taskStatus,
              notes,
              delayDays,
              startDate,
              duration: toPositiveInt(duration, task.duration || 1)
            })}
            style={{ ...primaryButton, flex: 2 }}
          >
            ???          </button>
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
  const activeTasks = project.tasks.filter((task) => task.isEnabled !== false);
  const datePoints = activeTasks.flatMap((task) => [task.scheduledStart, task.scheduledEnd]).filter(Boolean);
  const minDate = datePoints.length ? datePoints.reduce((a, b) => (a < b ? a : b)) : TODAY;
  const maxDate = datePoints.length ? datePoints.reduce((a, b) => (a > b ? a : b)) : TODAY;
  const totalDays = Math.max(1, diff(minDate, maxDate));
  const leftPct = (start) => Math.max(0, Math.min(100, (diff(minDate, start) / totalDays) * 100));
  const widthPct = (start, end) => Math.max(1.2, ((Math.max(1, diff(start, end))) / totalDays) * 100);
  const chartEndDate = toStr(addDays(maxDate, 1));
  const axisDates = [];
  let axisCursor = new Date(minDate);
  while (toStr(axisCursor) <= chartEndDate) {
    axisDates.push(toStr(axisCursor));
    axisCursor = addDays(axisCursor, 1);
  }
  const monthTicks = axisDates.filter((d) => d.slice(8, 10) === "01");
  const yearTicks = axisDates.filter((d) => d.slice(5, 10) === "01-01");
  const fiveDayTicks = axisDates.filter((d) => {
    const day = Number(d.slice(8, 10));
    return day % 5 === 0;
  });

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(120px,1fr))", gap: 12 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>珥?吏꾪뻾瑜?</div>
          <div style={{ fontSize: 23, fontWeight: 900, color: "#7c3aed" }}>{progressAvg}%</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>紐⑺몴 異쒖떆??</div>
          <div style={{ fontSize: 23, fontWeight: 900, color: "#0f172a" }}>{fmt(launch?.scheduledEnd)}</div>
          <div style={{ fontSize: 11, color: dDay < 0 ? "#ef4444" : "#10b981", fontWeight: 700 }}>{dDay >= 0 ? `D-${dDay}` : `D+${Math.abs(dDay)} 지연`}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>?꾨즺 ?쒖뒪??</div>
          <div style={{ fontSize: 23, fontWeight: 900, color: "#059669" }}>{completedCount}/{project.tasks.length}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>吏???쒖뒪??</div>
          <div style={{ fontSize: 23, fontWeight: 900, color: delayedCount > 0 ? "#ef4444" : "#10b981" }}>{delayedCount}</div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "11px 14px", borderBottom: "1px solid #e2e8f0", fontWeight: 800 }}>媛꾪듃 李⑦듃</div>
        <div style={{ padding: 12, display: "grid", gap: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "170px 1fr", alignItems: "end", gap: 8 }}>
            <div />
            <div style={{ position: "relative", height: 46, borderBottom: "1px solid #e2e8f0" }}>
              {fiveDayTicks.map((d) => {
                const x = leftPct(d);
                return (
                  <div key={`day-${d}`} style={{ position: "absolute", left: `${x}%`, top: 30, transform: "translateX(-50%)", fontSize: 10, color: "#94a3b8" }}>
                    {Number(d.slice(8, 10))}
                  </div>
                );
              })}
              {monthTicks.map((d) => {
                const x = leftPct(d);
                return (
                  <div key={`month-${d}`} style={{ position: "absolute", left: `${x}%`, top: 16, transform: "translateX(2px)", fontSize: 10, color: "#64748b", fontWeight: 700 }}>
                    {Number(d.slice(5, 7))}??                  </div>
                );
              })}
              {yearTicks.map((d) => {
                const x = leftPct(d);
                return (
                  <div key={`year-${d}`} style={{ position: "absolute", left: `${x}%`, top: 1, transform: "translateX(2px)", fontSize: 10, color: "#334155", fontWeight: 900 }}>
                    {d.slice(0, 4)}??                  </div>
                );
              })}
            </div>
          </div>

          {activeTasks.map((task) => (
            <div key={task.id} style={{ display: "grid", gridTemplateColumns: "170px 1fr", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#334155", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {task.icon} {task.name}
              </div>
              <div style={{ position: "relative", height: 18, background: "#f1f5f9", borderRadius: 999, overflow: "hidden" }}>
                {fiveDayTicks.map((d) => (
                  <div key={`g5-${task.id}-${d}`} style={{ position: "absolute", left: `${leftPct(d)}%`, top: 0, bottom: 0, borderLeft: "1px dashed #cbd5e1" }} />
                ))}
                {monthTicks.map((d) => (
                  <div key={`gm-${task.id}-${d}`} style={{ position: "absolute", left: `${leftPct(d)}%`, top: 0, bottom: 0, borderLeft: "1px solid #94a3b8" }} />
                ))}
                {yearTicks.map((d) => (
                  <div key={`gy-${task.id}-${d}`} style={{ position: "absolute", left: `${leftPct(d)}%`, top: 0, bottom: 0, borderLeft: "2px solid #475569" }} />
                ))}
                <div
                  style={{
                    position: "absolute",
                    left: `${leftPct(task.scheduledStart)}%`,
                    width: `${widthPct(task.scheduledStart, task.scheduledEnd)}%`,
                    top: 1,
                    bottom: 1,
                    background: task.taskStatus === "delayed" ? "#ef4444" : task.color,
                    borderRadius: 999,
                    zIndex: 2
                  }}
                  title={`${fmt(task.scheduledStart)} ~ ${fmt(task.scheduledEnd)}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "11px 14px", borderBottom: "1px solid #e2e8f0", fontWeight: 800 }}>?쒖뒪???꾪솴</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["?쒖뒪??, "?곹깭", "?쒖옉", "?꾨즺", "湲곌컙", "吏꾪뻾瑜?].map((h) => (
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
                <td style={{ padding: "9px 12px", fontSize: 12 }}>{task.duration}??/td>
                <td style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700 }}>{task.progress || 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TasksTab({
  project,
  onTaskSave,
  onTaskToggle,
  onProjectStartChange,
  onDevelopSubTimelineUpdate,
  forcedEditTaskId,
  onForcedEditHandled
}) {
  const [editTask, setEditTask] = useState(null);
  const [projectStart, setProjectStart] = useState(project.start || TODAY);
  const [draftStartDates, setDraftStartDates] = useState({});
  const [draftSupplierNames, setDraftSupplierNames] = useState({});
  const developTask = project.tasks.find((task) => task.id === DEVELOP_TASK_ID);
  const developDuration = toPositiveInt(developTask?.duration, 1);
  const developTimeline = developTask
    ? normalizeDevelopSubTimeline(project.developSubTimeline, developDuration)
    : [];

  useEffect(() => {
    setProjectStart(project.start || TODAY);
  }, [project.id, project.start]);

  useEffect(() => {
    setDraftStartDates(Object.fromEntries((project.tasks || []).map((task) => [task.id, task.scheduledStart || TODAY])));
    setDraftSupplierNames(Object.fromEntries((project.tasks || []).map((task) => [task.id, task.vendorName || ""])));
  }, [project.id, project.tasks]);

  useEffect(() => {
    if (!forcedEditTaskId) return;
    const target = (project.tasks || []).find((task) => task.id === forcedEditTaskId);
    if (target) setEditTask(target);
    if (onForcedEditHandled) onForcedEditHandled();
  }, [forcedEditTaskId, onForcedEditHandled, project.tasks]);

  const saveDevelopItem = (itemId, field, value) => {
    if (!developTask) return;
    const numeric = Number(value);
    const raw = developTimeline.map((item) => (
      item.id === itemId ? { ...item, [field]: Number.isFinite(numeric) ? numeric : item[field] } : item
    ));
    onDevelopSubTimelineUpdate(normalizeDevelopSubTimeline(raw, developDuration));
  };
  const toggleSensory = () => {
    const raw = developTimeline.map((item) => (
      item.id === "dev_sensory" ? { ...item, enabled: item.enabled === false ? true : false } : item
    ));
    onDevelopSubTimelineUpdate(normalizeDevelopSubTimeline(raw, developDuration));
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>?쒖뒪???쇱젙/吏꾪뻾 ?섏젙</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>?꾨줈?앺듃 ?쒖옉??</span>
          <input type="date" value={projectStart} onChange={(e) => setProjectStart(e.target.value)} style={{ ...inputStyle, width: 150, padding: "6px 8px", fontSize: 12 }} />
          <button
            onClick={() => onProjectStartChange(projectStart)}
            style={{ padding: "6px 9px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
          >
            ?곸슜
          </button>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {["활성", "태스크", "시작일", "완료일", "업체(공급업체 예정)", "상태", "진행률", "메모", ""].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontSize: 11, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {project.tasks.flatMap((task) => {
            const enabled = task.isEnabled !== false;
            const rows = [
              <tr key={task.id} style={{ borderBottom: "1px solid #f1f5f9", opacity: enabled ? 1 : 0.55 }}>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>
                  <button
                    onClick={() => onTaskToggle(task, !enabled)}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 999,
                      border: "1px solid " + (enabled ? "#10b981" : "#cbd5e1"),
                      background: enabled ? "#dcfce7" : "#f1f5f9",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: enabled ? "flex-end" : "flex-start",
                      padding: 2
                    }}
                    title={enabled ? "활성화됨" : "비활성화됨"}
                  >
                    <span style={{ width: 18, height: 18, borderRadius: 999, background: enabled ? "#16a34a" : "#94a3b8", display: "block" }} />
                  </button>
                </td>
                <td style={{ padding: "9px 12px", fontSize: 13, fontWeight: 700 }}>{task.icon} {task.name}</td>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>
                  <input
                    type="date"
                    value={draftStartDates[task.id] || task.scheduledStart}
                    onChange={(event) => {
                      const next = event.target.value;
                      setDraftStartDates((prev) => ({ ...prev, [task.id]: next }));
                    }}
                    onBlur={(event) => {
                      const next = event.target.value;
                      if (next && next !== task.scheduledStart) onTaskSave(task, { startDate: next });
                    }}
                    style={{ ...inputStyle, width: 140, padding: "5px 8px", fontSize: 12 }}
                    disabled={!enabled}
                  />
                </td>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>{fmt(task.scheduledEnd)}</td>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>
                  {task.id === "supplier" ? (
                    <input
                      value={draftSupplierNames[task.id] || ""}
                      onChange={(event) => {
                        const next = event.target.value;
                        setDraftSupplierNames((prev) => ({ ...prev, [task.id]: next }));
                      }}
                      onBlur={(event) => {
                        const next = event.target.value.trim();
                        if (next !== (task.vendorName || "")) onTaskSave(task, { vendorName: next });
                      }}
                      placeholder="?좎젙 ?낆껜紐??낅젰"
                      style={{ ...inputStyle, width: 180, padding: "5px 8px", fontSize: 12 }}
                      disabled={!enabled}
                    />
                  ) : (
                    <span style={{ color: "#94a3b8" }}>-</span>
                  )}
                </td>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>{STATUS_LABEL[task.taskStatus]}</td>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>{task.progress || 0}%</td>
                <td style={{ padding: "9px 12px", fontSize: 12, color: "#64748b", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.notes || "-"}</td>
                <td style={{ padding: "9px 12px" }}>
                  <button onClick={() => setEditTask(task)} style={{ padding: "6px 9px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 12 }} disabled={!enabled}>
                    ?섏젙
                  </button>
                </td>
              </tr>
            ];

            if (task.id === DEVELOP_TASK_ID && developTask && enabled) {
              rows.push(
                <tr key={`${task.id}__subtimeline`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td colSpan={9} style={{ padding: "10px 12px 14px", background: "#f8fafc" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
                      ?쒗뭹 媛쒕컻 遺???쇱젙 (?쒗뭹 媛쒕컻 {developTask.duration}????
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {developTimeline.map((item) => {
                        const enabled = item.enabled !== false;
                        const itemStart = toStr(addDays(developTask.scheduledStart, item.startOffset));
                        const itemEnd = toStr(addDays(itemStart, item.duration));
                        const leftPct = (item.startOffset / developDuration) * 100;
                        const widthPct = (item.duration / developDuration) * 100;
                        return (
                          <div key={item.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", padding: 8, opacity: enabled ? 1 : 0.45 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "170px 100px 100px 1fr", gap: 8, alignItems: "center", marginBottom: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 700 }}>{item.name}</div>
                                {item.id === "dev_sensory" && (
                                  <button
                                    onClick={toggleSensory}
                                    style={{
                                      width: 40,
                                      height: 20,
                                      borderRadius: 999,
                                      border: "1px solid " + (enabled ? "#10b981" : "#cbd5e1"),
                                      background: enabled ? "#dcfce7" : "#f1f5f9",
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: enabled ? "flex-end" : "flex-start",
                                      padding: 2
                                    }}
                                    title={enabled ? "愿?λ룄 ?뚯뒪??ON" : "愿?λ룄 ?뚯뒪??OFF"}
                                  >
                                    <span style={{ width: 14, height: 14, borderRadius: 999, background: enabled ? "#16a34a" : "#94a3b8", display: "block" }} />
                                  </button>
                                )}
                              </div>
                              <input
                                type="number"
                                min={0}
                                value={item.startOffset}
                                onChange={(event) => saveDevelopItem(item.id, "startOffset", event.target.value)}
                                style={{ ...inputStyle, fontSize: 12, padding: "5px 8px" }}
                                title="?쒖옉 ?ㅽ봽????"
                                disabled={!enabled}
                              />
                              <input
                                type="number"
                                min={1}
                                value={item.duration}
                                onChange={(event) => saveDevelopItem(item.id, "duration", event.target.value)}
                                style={{ ...inputStyle, fontSize: 12, padding: "5px 8px" }}
                                title="湲곌컙(??"
                                disabled={!enabled}
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
    channel: "?꾪솕",
    summary: "",
    outcome: "",
    nextAction: ""
  });
  const logs = project.communicationLog || [];

  const save = () => {
    if (!form.company || !form.summary) {
      window.alert("?낆껜紐낃낵 ?뚰넻 ?댁슜???낅젰?섏꽭??");
      return;
    }
    onSaveLog({ ...form, id: Date.now() });
    setForm({ date: TODAY, company: "", contact: "", channel: "?꾪솕", summary: "", outcome: "", nextAction: "" });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14 }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>?낆껜 ?뚰넻 湲곕줉</div>
        <div style={{ display: "grid", gap: 8 }}>
          <input placeholder="?낆껜紐?*" value={form.company} onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))} style={inputStyle} />
          <input placeholder="담당자" value={form.contact} onChange={(e) => setForm((prev) => ({ ...prev, contact: e.target.value }))} style={inputStyle} />
          <input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} style={inputStyle} />
          <select value={form.channel} onChange={(e) => setForm((prev) => ({ ...prev, channel: e.target.value }))} style={inputStyle}>
            {["전화", "이메일", "미팅", "메신저", "방문", "기타"].map((value) => <option key={value}>{value}</option>)}
          </select>
          <textarea rows={3} placeholder="?뚰넻 ?댁슜 *" value={form.summary} onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))} style={{ ...inputStyle, resize: "vertical" }} />
          <textarea rows={2} placeholder="?먮떒/寃곌낵 (?? A?낆껜 ?쒖쇅, B?낆껜 吏꾪뻾)" value={form.outcome} onChange={(e) => setForm((prev) => ({ ...prev, outcome: e.target.value }))} style={{ ...inputStyle, resize: "vertical" }} />
          <input placeholder="?꾩냽 議곗튂" value={form.nextAction} onChange={(e) => setForm((prev) => ({ ...prev, nextAction: e.target.value }))} style={inputStyle} />
          <button onClick={save} style={primaryButton}>???</button>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontWeight: 800 }}>?뚰넻 ?덉뒪?좊━ ({logs.length}嫄?</div>
          <button
            onClick={() => {
              if (!logs.length) return window.alert("?대낫???곗씠?곌? ?놁뒿?덈떎.");
              downloadFile(`${project.name}_communication.csv`, toCsv(logs), "text/csv;charset=utf-8;");
            }}
            style={subtleButton}
          >
            CSV ?대낫?닿린
          </button>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {[...logs].reverse().map((item) => (
            <div key={item.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontWeight: 800 }}>{item.company}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{fmt(item.date)} 쨌 {item.channel}</div>
              </div>
              <div style={{ fontSize: 13, marginBottom: 5 }}>{item.summary}</div>
              {item.outcome && <div style={{ fontSize: 12, color: "#0369a1", marginBottom: 3 }}>寃곌낵: {item.outcome}</div>}
              {item.nextAction && <div style={{ fontSize: 12, color: "#b45309" }}>?꾩냽: {item.nextAction}</div>}
            </div>
          ))}
          {logs.length === 0 && <div style={{ color: "#94a3b8", textAlign: "center", padding: 24 }}>湲곕줉???놁뒿?덈떎.</div>}
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
    impact: "蹂댄넻",
    status: "?섏궗寃곗젙 ?꾨즺",
    description: ""
  });
  const logs = project.decisionLog || [];

  const save = () => {
    if (!form.title || !form.description) {
      window.alert("?덇굔紐낃낵 ?섏궗寃곗젙 ?곸꽭 ?댁슜???낅젰?섏꽭??");
      return;
    }
    onSaveLog({ ...form, id: Date.now() });
    setForm({ date: TODAY, decider: "대표", title: "", impact: "보통", status: "의사결정 완료", description: "" });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14 }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>???遺????섏궗寃곗젙 湲곕줉</div>
        <div style={{ display: "grid", gap: 8 }}>
          <input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} style={inputStyle} />
          <select value={form.decider} onChange={(e) => setForm((prev) => ({ ...prev, decider: e.target.value }))} style={inputStyle}>
            {["???, "遺???, "怨듬룞寃곗젙"].map((value) => <option key={value}>{value}</option>)}
          </select>
          <input placeholder="?덇굔紐?*" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} style={inputStyle} />
          <select value={form.impact} onChange={(e) => setForm((prev) => ({ ...prev, impact: e.target.value }))} style={inputStyle}>
            {["??쓬", "蹂댄넻", "?믪쓬", "?щ━?곗뺄"].map((value) => <option key={value}>{value}</option>)}
          </select>
          <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} style={inputStyle}>
            {["寃?좎쨷", "?섏궗寃곗젙 ?꾨즺", "蹂대쪟"].map((value) => <option key={value}>{value}</option>)}
          </select>
          <textarea rows={5} placeholder="?섏궗寃곗젙 諛곌꼍/寃곕줎/議곌굔 *" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} style={{ ...inputStyle, resize: "vertical" }} />
          <button onClick={save} style={primaryButton}>???</button>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontWeight: 800 }}>?섏궗寃곗젙 ?꾩뭅?대툕 ({logs.length}嫄?</div>
          <button
            onClick={() => {
              if (!logs.length) return window.alert("?대낫???곗씠?곌? ?놁뒿?덈떎.");
              downloadFile(`${project.name}_decisions.csv`, toCsv(logs), "text/csv;charset=utf-8;");
            }}
            style={subtleButton}
          >
            CSV ?대낫?닿린
          </button>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {[...logs].reverse().map((item) => (
            <div key={item.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", overflow: "hidden" }}>
              <div style={{ padding: "8px 10px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 800 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{item.decider} 쨌 {fmt(item.date)}</div>
              </div>
              <div style={{ padding: 10, fontSize: 13, whiteSpace: "pre-wrap" }}>{item.description}</div>
            </div>
          ))}
          {logs.length === 0 && <div style={{ color: "#94a3b8", textAlign: "center", padding: 24 }}>湲곕줉???놁뒿?덈떎.</div>}
        </div>
      </div>
    </div>
  );
}

function BackupTab({ projects, adminLogs, selectedProject, onRestore, isAdmin }) {
  const fileInputRef = useRef(null);

  const exportAllJson = () => {
    const content = JSON.stringify({ projects, adminLogs }, null, 2);
    downloadFile(`Charmacist_PB_backup_${toStr(new Date())}.json`, content, "application/json");
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
        <div style={{ fontWeight: 800, marginBottom: 8 }}>諛깆뾽/蹂듭썝</div>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 10 }}>
          ?쒕쾭 DB媛 湲곕낯 ??μ냼?대ŉ, ?꾨옒 ?뚯씪 諛깆뾽? ?댁쨷 ?덉쟾?μ튂?낅땲??
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={exportAllJson} style={primaryButton}>?꾩껜 JSON 諛깆뾽</button>
          <button onClick={exportProjectCsv} style={subtleButton}>?꾩옱 ?꾨줈?앺듃 ?쒖뒪??CSV</button>
          {isAdmin && <button onClick={() => fileInputRef.current?.click()} style={subtleButton}>JSON 諛깆뾽?뚯씪 遺덈윭?ㅺ린</button>}
        </div>
        {!isAdmin && <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>蹂듭썝 湲곕뒫? admin 沅뚰븳?먯꽌留?媛?ν빀?덈떎.</div>}
      </div>
      {isAdmin && <input
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
            const nextProjects = Array.isArray(parsed)
              ? parsed
              : (Array.isArray(parsed?.projects) ? parsed.projects : null);
            if (!Array.isArray(nextProjects)) throw new Error("?꾨줈?앺듃 諛곗뿴 ?뺤떇???꾨떃?덈떎.");
            const nextAdminLogs = Array.isArray(parsed?.adminLogs) ? parsed.adminLogs : [];
            onRestore({
              projects: normalizeProjects(nextProjects),
              adminLogs: normalizeAdminLogs(nextAdminLogs)
            });
            window.alert("諛깆뾽 ?곗씠??蹂듭썝???꾨즺?섏뿀?듬땲??");
          } catch (error) {
            window.alert(`蹂듭썝 ?ㅽ뙣: ${String(error.message || error)}`);
          } finally {
            event.target.value = "";
          }
        }}
      />}
    </div>
  );
}

function BasicInfoTab({ project, onSave }) {
  const [form, setForm] = useState({
    name: project.name || "",
    pmName: project.pmName || "",
    amName: project.amName || "",
    category: project.category || CATEGORIES[0],
    start: project.start || TODAY
  });
  const categoryOptions = CATEGORIES.includes(form.category) ? CATEGORIES : [form.category, ...CATEGORIES];

  useEffect(() => {
    setForm({
      name: project.name || "",
      pmName: project.pmName || "",
      amName: project.amName || "",
      category: project.category || CATEGORIES[0],
      start: project.start || TODAY
    });
  }, [project.id, project.name, project.pmName, project.amName, project.category, project.start]);

  const metaLogs = (project.changeLog || [])
    .filter((log) => log?.type === "project_meta")
    .slice()
    .reverse();

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>?꾨줈?앺듃 湲곕낯?뺣낫 ?섏젙</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>?꾨줈?앺듃紐?</label>
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>移댄뀒怨좊━</label>
            <select value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} style={inputStyle}>
              {categoryOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>PM</label>
            <input value={form.pmName} onChange={(event) => setForm((prev) => ({ ...prev, pmName: event.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>AM</label>
            <input value={form.amName} onChange={(event) => setForm((prev) => ({ ...prev, amName: event.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>?쒖옉??</label>
            <input type="date" value={form.start} onChange={(event) => setForm((prev) => ({ ...prev, start: event.target.value }))} style={inputStyle} />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => {
              const nextName = form.name.trim();
              const nextPm = form.pmName.trim();
              const nextAm = form.amName.trim();
              if (!nextName) {
                window.alert("?꾨줈?앺듃紐낆쓣 ?낅젰?섏꽭??");
                return;
              }
              if (!nextPm && !nextAm) {
                window.alert("PM ?먮뒗 AM 以?理쒖냼 1紐낆? ?낅젰?섏꽭??");
                return;
              }
              onSave({
                name: nextName,
                pmName: nextPm,
                amName: nextAm,
                category: form.category,
                start: form.start || TODAY
              });
            }}
            style={primaryButton}
          >
            湲곕낯?뺣낫 ???          </button>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>湲곕낯?뺣낫 蹂寃??대젰</div>
        <div style={{ display: "grid", gap: 6 }}>
          {metaLogs.map((log) => (
            <div key={log.id} style={{ fontSize: 12, color: "#475569", background: "#f8fafc", borderRadius: 6, padding: "7px 10px" }}>
              {fmt(log.date)} 쨌 {log.reason}
            </div>
          ))}
          {metaLogs.length === 0 && (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>蹂寃??대젰???놁뒿?덈떎.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdvisorTab({ project, onSaveLog }) {
  const [form, setForm] = useState({
    name: "",
    datetime: "",
    content: ""
  });
  const logs = project.advisorLog || [];

  const save = () => {
    const name = form.name.trim();
    const datetime = form.datetime;
    const content = form.content.trim();
    if (!name || !datetime || !content) {
      window.alert("?대쫫, ?쇱떆, ??붾궡?⑹쓣 紐⑤몢 ?낅젰?섏꽭??");
      return;
    }
    onSaveLog({ id: Date.now(), name, datetime, content });
    setForm({ name: "", datetime: "", content: "" });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14 }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>?먮Ц?쎌궗 ?섍껄 ?낅젰</div>
        <div style={{ display: "grid", gap: 8 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>?대쫫</label>
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>?쇱떆</label>
            <input type="datetime-local" value={form.datetime} onChange={(event) => setForm((prev) => ({ ...prev, datetime: event.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>??붾궡??</label>
            <textarea rows={5} value={form.content} onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <button onClick={save} style={primaryButton}>???</button>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>?먮Ц?쎌궗 湲곕줉 ({logs.length}嫄?</div>
        <div style={{ display: "grid", gap: 8 }}>
          {[...logs].reverse().map((log) => (
            <div key={log.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontWeight: 800 }}>{log.name}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{log.datetime}</div>
              </div>
              <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{log.content}</div>
            </div>
          ))}
          {logs.length === 0 && (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>??λ맂 ?먮Ц?쎌궗 ?섍껄???놁뒿?덈떎.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function HomeDashboardTab({ projects, onOpenProject, onReminderYes, onReminderNo }) {
  const items = (projects || []).map((project) => {
    const currentTask = getCurrentStageTask(project);
    const reminder = buildStageReminderMessage(currentTask);
    const delayedCount = (project.tasks || []).filter((task) => task.taskStatus === "delayed").length;
    const lastCheck = [...(project.stageCheckLog || [])]
      .reverse()
      .find((log) => (currentTask ? log.taskId === currentTask.id : true));
    return { project, currentTask, reminder, delayedCount, lastCheck };
  });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>???먭? 蹂대뱶</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          ?꾩옱 ?④퀎 由щ쭏?몃뱶瑜??뺤씤?섍퀬, 臾몄젣媛 ?덉쑝硫?諛붾줈 吏???곸슜 ?앹뾽?쇰줈 ?대룞?????덉뒿?덈떎.
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {items.map(({ project, currentTask, reminder, delayedCount, lastCheck }) => (
          <div key={project.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10, marginBottom: 8 }}>
              <div>
                <button
                  onClick={() => onOpenProject(project.id)}
                  style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", color: "#0f172a", fontWeight: 900, fontSize: 14 }}
                >
                  {project.name}
                </button>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  ?대떦: {formatOwners(project)} 쨌 移댄뀒怨좊━: {project.category}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>?꾩옱 ?④퀎</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                  {currentTask ? `${currentTask.icon} ${currentTask.name}` : "-"}
                </div>
              </div>
            </div>

            <div
              style={{
                fontSize: 12,
                color: reminder.isLate ? "#b91c1c" : "#0f766e",
                background: reminder.isLate ? "#fef2f2" : "#ecfeff",
                border: `1px solid ${reminder.isLate ? "#fecaca" : "#a5f3fc"}`,
                borderRadius: 8,
                padding: "8px 10px",
                marginBottom: 8
              }}
            >
              {reminder.text}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                吏???쒖뒪??{delayedCount}嫄?                {lastCheck && (
                  <span style={{ marginLeft: 8 }}>
                    理쒓렐 ?먭?: {lastCheck.answer === "yes" ? "Y" : "N"} ({new Date(lastCheck.date).toLocaleString()})
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => currentTask && onReminderYes(project, currentTask)}
                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #86efac", background: "#dcfce7", color: "#166534", cursor: "pointer", fontSize: 12, fontWeight: 800 }}
                  disabled={!currentTask}
                >
                  Y
                </button>
                <button
                  onClick={() => currentTask && onReminderNo(project, currentTask)}
                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fee2e2", color: "#b91c1c", cursor: "pointer", fontSize: 12, fontWeight: 800 }}
                  disabled={!currentTask}
                >
                  N
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
            ?쒖떆???꾨줈?앺듃媛 ?놁뒿?덈떎.
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectLifecycleLogTab({ logs, onDeleteLog, onToggleHiddenForManager, isAdmin }) {
  const sortedLogs = [...(logs || [])].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  const typeLabel = (type) => {
    if (type === "project_create") return "?좎꽕";
    if (type === "project_delete") return "??젣";
    if (type === "task_start_date_change") return "?쒖뒪???쇱젙";
    if (type === "project_start_date_change") return "?꾨줈?앺듃 ?좎쭨";
    if (type === "basic_info_update") return "湲곕낯?뺣낫";
    if (type === "advisor_log_add") return "?먮Ц?쎌궗";
    if (type === "communication_log_add") return "?낆껜?뚰넻";
    if (type === "decision_log_add") return "?섏궗寃곗젙";
    if (type === "stage_check_yes") return "?먭?(Y)";
    if (type === "stage_check_issue") return "?먭?(N)";
    return "湲곕줉";
  };

  const typeColor = (type) => {
    if (type === "project_create") return { fg: "#166534", bg: "#dcfce7" };
    if (type === "project_delete") return { fg: "#b91c1c", bg: "#fee2e2" };
    if (type === "task_start_date_change" || type === "project_start_date_change") return { fg: "#1d4ed8", bg: "#dbeafe" };
    if (type === "basic_info_update") return { fg: "#7c3aed", bg: "#f3e8ff" };
    if (type === "advisor_log_add" || type === "communication_log_add" || type === "decision_log_add") return { fg: "#0f766e", bg: "#ccfbf1" };
    if (type === "stage_check_yes") return { fg: "#166534", bg: "#dcfce7" };
    if (type === "stage_check_issue") return { fg: "#b91c1c", bg: "#fee2e2" };
    return { fg: "#475569", bg: "#e2e8f0" };
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>?꾩옱 ?꾨줈?앺듃 ?대젰 濡쒓렇</div>
      <div style={{ display: "grid", gap: 8 }}>
        {sortedLogs.map((log) => {
          const badge = typeColor(log.type);
          return (
            <div key={log.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: badge.fg, background: badge.bg, borderRadius: 999, padding: "2px 8px" }}>
                    {typeLabel(log.type)}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{log.projectName || "-"}</span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>{log.actor || "愿由ъ옄"}</span>
                  {log.hiddenForManager && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#92400e", background: "#fef3c7", borderRadius: 999, padding: "2px 8px" }}>
                      MANAGER 숨김
                    </span>
                  )}
                </div>
                {isAdmin && <button
                  onClick={() => onToggleHiddenForManager?.(log.id)}
                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d6d3d1", background: "#fff", color: "#57534e", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                >
                  {log.hiddenForManager ? "MANAGER에 표시" : "MANAGER에 숨김"}
                </button>}
                {isAdmin && <button
                  onClick={() => {
                    if (!window.confirm("??濡쒓렇瑜???젣?섏떆寃좎뒿?덇퉴?")) return;
                    onDeleteLog(log.id);
                  }}
                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #fecaca", background: "#fff", color: "#dc2626", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                >
                  濡쒓렇 ??젣
                </button>}
              </div>
              <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>
                ?ъ쑀: {log.reason || "-"}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}
              </div>
            </div>
          );
        })}
        {sortedLogs.length === 0 && (
          <div style={{ fontSize: 12, color: "#94a3b8" }}>?꾩쭅 湲곕줉???꾨줈?앺듃 ?좎꽕/??젣 濡쒓렇媛 ?놁뒿?덈떎.</div>
        )}
      </div>
    </div>
  );
}

export default function PmsApp() {
  const router = useRouter();
  const { projects, setProjects, adminLogs, setAdminLogs, syncState } = useProjectsStore();
  const [userRole, setUserRole] = useState(ROLE_GUEST);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("overview");
  const initialUrlAppliedRef = useRef(false);
  const [forcedEdit, setForcedEdit] = useState(null);
  const [isHome, setIsHome] = useState(() => {
    if (typeof window === "undefined") return true;
    return !new URLSearchParams(window.location.search).get("project");
  });
  const isAdmin = canManage(userRole);
  const roleLabel = isAdmin ? "ADMIN" : "MANAGER";

  useEffect(() => {
    let disposed = false;
    async function fetchRole() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!disposed) setUserRole(payload?.role === ROLE_ADMIN ? ROLE_ADMIN : ROLE_GUEST);
      } catch {
        if (!disposed) setUserRole(ROLE_GUEST);
      }
    }
    fetchRole();
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!projects.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => (prev && projects.some((project) => project.id === prev) ? prev : projects[0].id));
  }, [projects]);

  useEffect(() => {
    if (initialUrlAppliedRef.current) return;
    if (!projects.length || typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("project");
    const requestedId = Number(raw);
    if (Number.isFinite(requestedId) && projects.some((project) => project.id === requestedId)) {
      setSelectedId(requestedId);
      setIsHome(false);
    }
    initialUrlAppliedRef.current = true;
  }, [projects]);

  useEffect(() => {
    if (isAdmin) return;
    if (tab === "project_logs" || tab === "backup") {
      setTab("overview");
    }
  }, [isAdmin, tab]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedId),
    [projects, selectedId]
  );
  const selectedProjectAdminLogs = useMemo(() => {
    if (!selectedProject) return [];
    const scopedLogs = (adminLogs || []).filter((log) => String(log?.projectId) === String(selectedProject.id));
    if (isAdmin) return scopedLogs;
    return scopedLogs.filter((log) => !log.hiddenForManager);
  }, [adminLogs, selectedProject, isAdmin]);

  const appendAdminLog = (entry) => {
    setAdminLogs((prev) => normalizeAdminLogs([
      ...(prev || []),
      {
        id: Date.now() + Math.floor(Math.random() * 1000),
        actor: "愿由ъ옄",
        createdAt: new Date().toISOString(),
        ...entry
      }
    ]));
  };

  const updateProject = (projectId, updater) => {
    setProjects((prev) => normalizeProjects(prev.map((project) => (project.id === projectId ? updater(project) : project))));
  };

  const goToNewProjectPage = () => {
    router.push("/projects/new");
  };

  const goToProjectLogsPage = () => {
    router.push("/project-logs");
  };

  const openProject = (projectId) => {
    setSelectedId(projectId);
    setIsHome(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("project", String(projectId));
      window.history.replaceState({}, "", url.toString());
    }
  };

  const PROJECT_BUCKETS = [
    { id: "in_progress", label: "진행 프로젝트", color: "#0ea5e9" },
    { id: "on_hold", label: "보류 프로젝트", color: "#f59e0b" },
    { id: "completed", label: "완료 프로젝트", color: "#10b981" }
  ];

  const groupedProjects = useMemo(() => {
    const groups = { in_progress: [], on_hold: [], completed: [] };
    (projects || []).forEach((p) => {
      const key = p.status === "completed" || p.status === "on_hold" ? p.status : "in_progress";
      groups[key].push(p);
    });
    return groups;
  }, [projects]);

  const moveProjectToBucket = (projectId, status) => {
    setProjects((prev) => normalizeProjects(prev.map((p) => (p.id === projectId ? { ...p, status } : p))));
  };

  const handleReminderYes = (project, task) => {
    updateProject(project.id, (current) => ({
      ...current,
      stageCheckLog: [
        ...(current.stageCheckLog || []),
        {
          id: Date.now(),
          taskId: task.id,
          answer: "yes",
          date: new Date().toISOString(),
          message: "문제없이 진행중"
        }
      ]
    }));
    appendAdminLog({
      type: "stage_check_yes",
      projectId: project.id,
      projectName: project.name,
      reason: `${task.name} ?④퀎 ?먭? ?묐떟: Y`
    });
  };

  const handleReminderNo = (project, task) => {
    updateProject(project.id, (current) => ({
      ...current,
      stageCheckLog: [
        ...(current.stageCheckLog || []),
        {
          id: Date.now(),
          taskId: task.id,
          answer: "no",
          date: new Date().toISOString(),
          message: "吏???ъ쑀 ?뺤씤 ?꾩슂"
        }
      ]
    }));
    appendAdminLog({
      type: "stage_check_issue",
      projectId: project.id,
      projectName: project.name,
      reason: `${task.name} ?④퀎 ?먭? ?묐떟: N (吏???곸슜 ?꾩슂)`
    });
    openProject(project.id);
    setTab("tasks");
    setForcedEdit({ projectId: project.id, taskId: task.id, token: Date.now() });
  };

  const deleteProject = (projectId) => {
    if (!isAdmin) {
      window.alert("愿由ъ옄(admin) 沅뚰븳???꾩슂?⑸땲??");
      return;
    }
    const target = projects.find((project) => project.id === projectId);
    if (!target) return;
    if (!window.confirm(`"${target.name}" ?꾨줈?앺듃瑜???젣?섏떆寃좎뒿?덇퉴?\n???묒뾽? ?섎룎由????놁뒿?덈떎.`)) return;
    const reason = window.prompt("??젣 ?ъ쑀瑜??낅젰?댁＜?몄슂.");
    if (reason === null) return;
    const reasonText = reason.trim();
    if (!reasonText) {
      window.alert("??젣 ?ъ쑀瑜??낅젰?댁빞 ?꾨줈?앺듃瑜???젣?????덉뒿?덈떎.");
      return;
    }

    const remaining = projects.filter((project) => project.id !== projectId);
    setProjects(normalizeProjects(remaining));
    setAdminLogs((prev) => normalizeAdminLogs([
      ...(prev || []),
      {
        id: Date.now(),
        type: "project_delete",
        projectId: target.id,
        projectName: target.name,
        reason: reasonText,
        actor: "愿由ъ옄",
        createdAt: new Date().toISOString()
      }
    ]));
    setSelectedId((prev) => (prev === projectId ? (remaining[0]?.id || null) : prev));
    if (remaining.length === 0) {
      setTab("overview");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      if (typeof window !== "undefined") window.location.reload();
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
            <ProjectSidebar
        isHome={isHome}
        setIsHome={setIsHome}
        setTab={setTab}
        isAdmin={isAdmin}
        goToNewProjectPage={goToNewProjectPage}
        goToProjectLogsPage={goToProjectLogsPage}
        groupedProjects={groupedProjects}
        projectBuckets={PROJECT_BUCKETS}
        moveProjectToBucket={moveProjectToBucket}
        selectedId={selectedId}
        openProject={openProject}
        formatOwners={formatOwners}
        TODAY={TODAY}
      />

      <main style={{ flex: 1, padding: 16, minWidth: 0 }}>
        {isHome ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>홈 대시보드</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>모든 프로젝트의 현재 진행 상태를 한눈에 확인합니다.</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <SyncBadge syncState={syncState} />
                <div style={{ fontSize: 11, fontWeight: 800, color: "#0f172a", background: "#e2e8f0", borderRadius: 999, padding: "3px 9px" }}>
                  {roleLabel}
                </div>
                <button
                  onClick={handleLogout}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                >
                  로그아웃
                </button>
              </div>
            </div>
            <HomeDashboardTab
              projects={projects}
              onOpenProject={openProject}
              onReminderYes={handleReminderYes}
              onReminderNo={handleReminderNo}
            />
          </>
        ) : (
          <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12 }}>
          <div>
            {selectedProject ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{selectedProject.name}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  담당: {formatOwners(selectedProject)} · 시작일: {fmt(selectedProject.start)} · 카테고리: {selectedProject.category}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 22, fontWeight: 900 }}>프로젝트 없음</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  새 프로젝트를 생성해 일정/소통/의사결정 기록을 시작하세요.
                </div>
              </>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <SyncBadge syncState={syncState} />
            <div style={{ fontSize: 11, fontWeight: 800, color: "#0f172a", background: "#e2e8f0", borderRadius: 999, padding: "3px 9px" }}>
              {roleLabel}
            </div>
            {selectedProject && isAdmin && (
              <button
                onClick={() => deleteProject(selectedProject.id)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#dc2626",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                ?꾨줈?앺듃 ??젣
              </button>
            )}
          </div>
        </div>

        {selectedProject ? (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {[
                ["overview", "개요"],
                ["tasks", "태스크 관리"],
                ["advisor", "자문약사 의견"],
                ["communication", "업체 소통 기록"],
                ["decision", "의사결정 기록"],
                ["basic", "기본정보 수정"],
                ["project_logs", "이력 로그"],
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
                  const hasTaskDateChange = Boolean(patch.startDate && patch.startDate !== task.scheduledStart);
                  const hasDelayChange = Boolean((patch.delayDays || 0) > 0);
                  const hasDurationChange = Boolean(typeof patch.duration === "number" && patch.duration !== task.duration);
                  updateProject(selectedProject.id, (project) => {
                    let tasks = project.tasks.map((currentTask) => (
                      currentTask.id === task.id
                        ? {
                            ...currentTask,
                            progress: patch.progress ?? currentTask.progress,
                            taskStatus: patch.taskStatus ?? currentTask.taskStatus,
                            notes: patch.notes ?? currentTask.notes,
                            vendorName: patch.vendorName ?? currentTask.vendorName,
                            duration: patch.duration ?? currentTask.duration
                          }
                        : currentTask
                    ));

                    if (patch.startDate && patch.startDate !== task.scheduledStart) {
                      tasks = applyStartDateChange(tasks, task.id, patch.startDate);
                    }
                    if (patch.delayDays > 0) tasks = applyDelay(tasks, task.id, patch.delayDays);
                    if (typeof patch.duration === "number" && patch.duration !== task.duration) {
                      tasks = applyDurationChange(tasks, task.id, patch.duration);
                    }

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
                          reason:
                            patch.notes ||
                            (typeof patch.vendorName === "string"
                              ? `怨듦툒?낆껜 湲곕줉: ${(task.vendorName || "-")} ??${(patch.vendorName || "-")}`
                              : (patch.startDate ? `?쒖옉??議곗젙: ${task.scheduledStart} ??${patch.startDate}` : "?섏젙")),
                          delayDays: patch.delayDays || 0,
                          duration: typeof patch.duration === "number" ? patch.duration : task.duration
                        }
                      ]
                    };
                  });
                  if (hasTaskDateChange || hasDelayChange || hasDurationChange) {
                    const reasonParts = [];
                    if (hasTaskDateChange) reasonParts.push(`?쒖옉?? ${task.scheduledStart} ??${patch.startDate}`);
                    if (hasDelayChange) reasonParts.push(`지연 적용: +${patch.delayDays}일`);
                    if (hasDurationChange) reasonParts.push(`기간: ${task.duration}일 -> ${patch.duration}일`);
                    appendAdminLog({
                      type: "task_start_date_change",
                      projectId: selectedProject.id,
                      projectName: selectedProject.name,
                      reason: `${task.name} ?쇱젙 蹂寃?(${reasonParts.join(" / ")})`
                    });
                  }
                }}
                onTaskToggle={(task, enabled) => {
                  updateProject(selectedProject.id, (project) => ({
                    ...project,
                    tasks: project.tasks.map((currentTask) => (
                      currentTask.id === task.id
                        ? {
                            ...currentTask,
                            isEnabled: enabled,
                            taskStatus: enabled
                              ? (currentTask.taskStatus === "on_hold" ? "pending" : currentTask.taskStatus)
                              : "on_hold"
                          }
                        : currentTask
                    )),
                    changeLog: [
                      ...(project.changeLog || []),
                      {
                        id: Date.now(),
                        type: "task_toggle",
                        taskId: task.id,
                        taskName: task.name,
                        date: TODAY,
                        reason: enabled ? "진행단계 활성화" : "진행단계 비활성화"
                      }
                    ]
                  }));
                }}
                onProjectStartChange={(nextStart) => {
                  if (!nextStart) return;
                  if (selectedProject.start === nextStart) return;
                  updateProject(selectedProject.id, (project) => {
                    if (project.start === nextStart) return project;
                    const schedule = calcSchedule(project.tasks, nextStart);
                    const nextTasks = project.tasks.map((task) => ({
                      ...task,
                      scheduledStart: schedule[task.id]?.start || task.scheduledStart,
                      scheduledEnd: schedule[task.id]?.end || task.scheduledEnd,
                      originalStart: schedule[task.id]?.start || task.originalStart,
                      originalEnd: schedule[task.id]?.end || task.originalEnd
                    }));
                    const developTask = nextTasks.find((task) => task.id === DEVELOP_TASK_ID);
                    return {
                      ...project,
                      start: nextStart,
                      tasks: nextTasks,
                      developSubTimeline: normalizeDevelopSubTimeline(project.developSubTimeline, developTask?.duration || 1),
                      changeLog: [
                        ...(project.changeLog || []),
                        {
                          id: Date.now(),
                          type: "project_start",
                          taskId: "_project_start",
                          taskName: "프로젝트 시작일",
                          date: TODAY,
                          reason: `?쒖옉??蹂寃? ${project.start} ??${nextStart}`
                        }
                      ]
                    };
                  });
                  appendAdminLog({
                    type: "project_start_date_change",
                    projectId: selectedProject.id,
                    projectName: selectedProject.name,
                    reason: `?꾨줈?앺듃 ?쒖옉??蹂寃? ${selectedProject.start} ??${nextStart}`
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
                        taskName: "?쒗뭹 媛쒕컻 遺???쇱젙",
                        date: TODAY,
                        reason: "하위 구성요소 기간/위치 변경"
                      }
                    ]
                  }));
                }}
                forcedEditTaskId={forcedEdit && forcedEdit.projectId === selectedProject.id ? forcedEdit.taskId : null}
                onForcedEditHandled={() => setForcedEdit(null)}
              />
            )}

            {tab === "advisor" && (
              <AdvisorTab
                project={selectedProject}
                onSaveLog={(item) => {
                  updateProject(selectedProject.id, (project) => ({
                    ...project,
                    advisorLog: [...(project.advisorLog || []), item]
                  }));
                  appendAdminLog({
                    type: "advisor_log_add",
                    projectId: selectedProject.id,
                    projectName: selectedProject.name,
                    reason: `${item.name} ?섍껄 ?깅줉 (${item.datetime})`
                  });
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
                  appendAdminLog({
                    type: "communication_log_add",
                    projectId: selectedProject.id,
                    projectName: selectedProject.name,
                    reason: `${item.company} ?뚰넻 湲곕줉 ?깅줉 (${item.date})`
                  });
                }}
              />
            )}

            {tab === "basic" && (
              <BasicInfoTab
                project={selectedProject}
                onSave={({ name, pmName, amName, category, start }) => {
                  const historyParts = [];
                  if (selectedProject.name !== name) historyParts.push(`?꾨줈?앺듃紐? ${selectedProject.name} ??${name}`);
                  if ((selectedProject.pmName || "") !== pmName) historyParts.push(`PM: ${selectedProject.pmName || "-"} ??${pmName || "-"}`);
                  if ((selectedProject.amName || "") !== amName) historyParts.push(`AM: ${selectedProject.amName || "-"} ??${amName || "-"}`);
                  if (selectedProject.category !== category) historyParts.push(`移댄뀒怨좊━: ${selectedProject.category} ??${category}`);
                  if (selectedProject.start !== start) historyParts.push(`?쒖옉?? ${selectedProject.start} ??${start}`);
                  if (historyParts.length === 0) return;

                  updateProject(selectedProject.id, (project) => {
                    const historyParts = [];
                    if (project.name !== name) historyParts.push(`?꾨줈?앺듃紐? ${project.name} ??${name}`);
                    if ((project.pmName || "") !== pmName) historyParts.push(`PM: ${project.pmName || "-"} ??${pmName || "-"}`);
                    if ((project.amName || "") !== amName) historyParts.push(`AM: ${project.amName || "-"} ??${amName || "-"}`);
                    if (project.category !== category) historyParts.push(`移댄뀒怨좊━: ${project.category} ??${category}`);
                    if (project.start !== start) historyParts.push(`?쒖옉?? ${project.start} ??${start}`);
                    if (historyParts.length === 0) return project;

                    const manager = [pmName, amName].filter(Boolean).join(" / ") || "誘몄젙";
                    let nextTasks = project.tasks;
                    if (project.start !== start) {
                      const schedule = calcSchedule(project.tasks, start);
                      nextTasks = project.tasks.map((task) => ({
                        ...task,
                        scheduledStart: schedule[task.id]?.start || task.scheduledStart,
                        scheduledEnd: schedule[task.id]?.end || task.scheduledEnd,
                        originalStart: schedule[task.id]?.start || task.originalStart,
                        originalEnd: schedule[task.id]?.end || task.originalEnd
                      }));
                    }

                    const developTask = nextTasks.find((task) => task.id === DEVELOP_TASK_ID);
                    return {
                      ...project,
                      name,
                      pmName,
                      amName,
                      manager,
                      category,
                      start,
                      tasks: nextTasks,
                      developSubTimeline: normalizeDevelopSubTimeline(project.developSubTimeline, developTask?.duration || 1),
                      changeLog: [
                        ...(project.changeLog || []),
                        {
                          id: Date.now(),
                          type: "project_meta",
                          taskId: "_project_meta",
                          taskName: "?꾨줈?앺듃 湲곕낯?뺣낫",
                          date: TODAY,
                          reason: historyParts.join(" / ")
                        }
                      ]
                    };
                  });
                  appendAdminLog({
                    type: "basic_info_update",
                    projectId: selectedProject.id,
                    projectName: selectedProject.name,
                    reason: historyParts.join(" / ")
                  });
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
                  appendAdminLog({
                    type: "decision_log_add",
                    projectId: selectedProject.id,
                    projectName: selectedProject.name,
                    reason: `${item.decider} 寃곗젙 ?깅줉: ${item.title}`
                  });
                }}
              />
            )}

            {tab === "project_logs" && (
              <ProjectLifecycleLogTab
                logs={selectedProjectAdminLogs}
                isAdmin={isAdmin}
                onToggleHiddenForManager={(logId) => {
                  if (!isAdmin) return;
                  setAdminLogs((prev) => normalizeAdminLogs((prev || []).map((log) => (
                    log.id === logId ? { ...log, hiddenForManager: !log.hiddenForManager } : log
                  ))));
                }}
                onDeleteLog={(logId) => {
                  if (!isAdmin) return;
                  setAdminLogs((prev) => normalizeAdminLogs((prev || []).filter((log) => log.id !== logId)));
                }}
              />
            )}

            {tab === "backup" && (
              <BackupTab
                projects={projects}
                adminLogs={adminLogs}
                selectedProject={selectedProject}
                isAdmin={isAdmin}
                onRestore={({ projects: nextProjects, adminLogs: nextAdminLogs }) => {
                  if (!isAdmin) return;
                  setProjects(normalizeProjects(nextProjects));
                  setAdminLogs(normalizeAdminLogs(nextAdminLogs));
                  if (nextProjects.length > 0) setSelectedId(nextProjects[0].id);
                  else setSelectedId(null);
                }}
              />
            )}
          </>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>생성된 프로젝트가 없습니다.</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
              첫 프로젝트를 만들면 일정 관리, 업체 소통 기록, 의사결정 기록을 바로 시작할 수 있습니다.
            </div>
            <button onClick={goToNewProjectPage} style={primaryButton}>
              + 첫 프로젝트 만들기
            </button>
          </div>
        )}
          </>
        )}
      </main>
    </div>
  );
}





