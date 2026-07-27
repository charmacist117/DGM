"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DistributionStructureTab from "@/components/DistributionStructureTab";
import MarketSizeAnalysisTab from "@/components/MarketSizeAnalysisTab";
import ProjectSidebar from "@/components/ProjectSidebar";
import DesktopProjectPathControl from "@/components/DesktopProjectPathControl";
import {
  CATEGORIES,
  DRAFT_CHECKLIST_FIELDS,
  EXCLUSIVITY_OPTIONS,
  PHASES,
  PHASE_CATS,
  REGULATORY_DIRECTION_OPTIONS,
  STATUS_COLOR,
  STATUS_LABEL,
  getDefaultDevelopSubTimeline,
  getInitialProjects,
  isOtcEtcCategory,
  normalizeDraftChecklist,
  normalizeExclusivityType,
  normalizeRegulatoryDirection
} from "@/lib/pms/defaults";
import { TODAY, addDays, diff, fmt, toStr } from "@/lib/pms/date";
import { parseFullBackup } from "@/lib/pms/fullBackup";
import {
  MODULE_BACKUP_TYPES,
  createModuleBackup,
  parseModuleBackup,
  supplyItemIdentityKey
} from "@/lib/pms/moduleBackup";
import {
  developmentModuleToCsv,
  distributionModuleToCsv,
  marketModuleToCsv,
  supplyModuleToCsv
} from "@/lib/pms/moduleCsv";
import { calcSchedule } from "@/lib/pms/schedule";
import { downloadFile } from "@/lib/pms/exporters";
import {
  normalizeMarketAnalysisDefaults,
  normalizeMarketSizeAnalysis
} from "@/lib/pms/marketAnalysis";

const LOCAL_CACHE_KEY = "pharmadev_pms_cache_v2";
const DEVELOP_TASK_ID = "develop";
const MERGED_SAMPLE_QUALITY_TASK_ID = "sample_quality";
const LEGACY_SAMPLE_TASK_ID = "sample";
const LEGACY_QUALITY_TASK_ID = "quality";
const ROLE_ADMIN = "admin";
const ROLE_GUEST = "guest";
const DASHBOARD_CHANGE_NOTICE_TYPE = "dashboard_change_notice";
const DASHBOARD_CHANGELOG_SEED_KEY = "pharmadev_dashboard_changelog_seed_20260724_1";
const DASHBOARD_PRICING_TABS_SEED_KEY = "pharmadev_dashboard_changelog_seed_20260724_2";
const DASHBOARD_MODULE_BACKUP_SEED_KEY = "pharmadev_dashboard_changelog_seed_20260724_3";
const DASHBOARD_PROJECT_BACKUP_REMOVAL_SEED_KEY = "pharmadev_dashboard_changelog_seed_20260724_4";
const DASHBOARD_HOME_SPLIT_SEED_KEY = "pharmadev_dashboard_changelog_seed_20260724_5";
const DASHBOARD_HOME_BUTTON_STYLE_SEED_KEY = "pharmadev_dashboard_changelog_seed_20260724_6";
const DASHBOARD_DISTRIBUTION_RESET_SEED_KEY = "pharmadev_dashboard_changelog_seed_20260724_7";
const DASHBOARD_SECURITY_HARDENING_SEED_KEY = "pharmadev_dashboard_changelog_seed_20260727_8";
const DASHBOARD_MARKET_ANALYSIS_SEED_KEY = "pharmadev_dashboard_changelog_seed_20260727_9";
const DASHBOARD_MARKET_SEARCH_FIX_SEED_KEY = "pharmadev_dashboard_changelog_seed_20260727_10";
const DASHBOARD_SUPPLY_SCROLL_FIX_SEED_KEY = "pharmadev_dashboard_changelog_seed_20260727_11";
const DASHBOARD_SUPPLY_DUPLICATE_SEED_KEY = "pharmadev_dashboard_changelog_seed_20260727_12";
const DASHBOARD_MARKET_GROWTH_COST_SEED_KEY = "pharmadev_dashboard_changelog_seed_20260727_13";
const DASHBOARD_MARKET_DEFAULT_FORECAST_SEED_KEY = "pharmadev_dashboard_changelog_seed_20260727_14";
const DASHBOARD_MARKET_GROWTH_YEAR_FILTER_SEED_KEY = "pharmadev_dashboard_changelog_seed_20260727_15";
const DASHBOARD_MARKET_YTD_PRORATION_FIX_SEED_KEY = "pharmadev_dashboard_changelog_seed_20260727_16";

const PHASE_TEMPLATE_BY_ID = Object.fromEntries(PHASES.map((phase) => [phase.id, phase]));
const PHASE_ID_SET = new Set(PHASES.map((phase) => phase.id));
const CAT_COLORS = {
  ...Object.fromEntries(PHASES.map((phase) => [phase.cat, phase.color])),
  기타: "#64748b"
};

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

const moduleTabButtonStyle = (active) => ({
  minWidth: 178,
  height: 48,
  padding: "0 28px",
  borderRadius: 10,
  border: "1px solid " + (active ? "#e2e8f0" : "rgba(148, 163, 184, .32)"),
  background: active ? "#fff" : "rgba(255, 255, 255, .08)",
  color: active ? "#0f172a" : "#e2e8f0",
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 900,
  boxShadow: active ? "0 8px 22px rgba(15, 23, 42, .16)" : "none"
});

const homeModuleTabButtonStyle = (active) => ({
  ...moduleTabButtonStyle(active),
  minWidth: 112,
  height: 42,
  padding: "0 18px",
  border: "1px solid " + (active ? "#7dd3fc" : "rgba(56, 189, 248, .55)"),
  background: active ? "#e0f2fe" : "rgba(14, 165, 233, .18)",
  color: active ? "#075985" : "#bae6fd",
  boxShadow: active ? "0 7px 18px rgba(14, 165, 233, .2)" : "none"
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

const supplyCompactInputStyle = { ...inputStyle, padding: "6px 8px", fontSize: 15 };
const supplyCompactTextareaStyle = { ...supplyCompactInputStyle, resize: "vertical", minHeight: 64 };
const supplyFieldLabelStyle = { display: "block", marginBottom: 4, fontSize: 12, color: "#64748b", fontWeight: 700 };
const supplyTextCellStyle = { fontSize: 15, color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.45 };
const supplyMoneyTextStyle = { ...supplyTextCellStyle, fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap", wordBreak: "keep-all" };
const supplyPrimaryButtonStyle = { ...primaryButton, fontSize: 15 };
const supplySubtleButtonStyle = { ...subtleButton, fontSize: 15 };
const supplyPanelStyle = {
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  boxShadow: "0 10px 26px rgba(15, 23, 42, .08)"
};
const supplyCardStyle = {
  ...supplyPanelStyle,
  overflow: "hidden",
  borderLeft: "5px solid #2563eb"
};
const supplyHeaderRowStyle = { background: "#e0f2fe" };
const supplyDetailHeaderRowStyle = { background: "#eef2ff" };
const supplyBodyRowStyle = { background: "#ffffff" };
const supplyDetailBodyRowStyle = { background: "#fbfdff" };
const supplyPriceFormat = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });

const INITIAL_SCHEDULE_VERSION = "v1.00";

function parseScheduleVersion(value) {
  if (value && typeof value === "object") {
    return {
      major: Math.max(1, Number(value.major) || 1),
      minor: Math.max(0, Math.min(99, Number(value.minor) || 0))
    };
  }
  const match = String(value || INITIAL_SCHEDULE_VERSION).trim().match(/^v?(\d+)(?:\.(\d+))?$/i);
  const major = Math.max(1, Number(match?.[1]) || 1);
  const rawMinor = match?.[2] || "0";
  const minor = Math.max(0, Math.min(99, Number(rawMinor.length === 1 ? `${rawMinor}0` : rawMinor) || 0));
  return { major, minor };
}

function formatScheduleVersion(value) {
  const { major, minor } = parseScheduleVersion(value);
  return `v${major}.${String(minor).padStart(2, "0")}`;
}

function nextScheduleVersion(currentVersion, changeCount) {
  const { major: currentMajor, minor: currentMinor } = parseScheduleVersion(currentVersion);
  const count = Math.max(1, Number(changeCount) || 1);

  if (count >= 6) return formatScheduleVersion({ major: currentMajor + 1, minor: 0 });

  if (count >= 3) {
    const nextTenth = Math.floor(currentMinor / 10) + 1;
    if (nextTenth >= 10) return formatScheduleVersion({ major: currentMajor + 1, minor: 0 });
    return formatScheduleVersion({ major: currentMajor, minor: nextTenth * 10 });
  }

  if (currentMinor >= 99) return formatScheduleVersion({ major: currentMajor + 1, minor: 0 });
  return formatScheduleVersion({ major: currentMajor, minor: currentMinor + 1 });
}

function snapshotSchedule(tasks = []) {
  return (tasks || []).map((task, index) => ({
    order: index + 1,
    id: task.id,
    icon: task.icon || "",
    name: task.name || "",
    start: task.scheduledStart || "",
    end: task.scheduledEnd || "",
    duration: task.duration || 0,
    isEnabled: task.isEnabled !== false
  }));
}

function normalizeScheduleVersionHistory(value) {
  return Array.isArray(value)
    ? value.filter((entry) => entry && typeof entry === "object").map((entry) => ({
      id: entry.id || `schedule_version_${Date.now()}_${Math.random()}`,
      version: formatScheduleVersion(entry.version),
      previousVersion: entry.previousVersion ? formatScheduleVersion(entry.previousVersion) : "",
      changeCount: Math.max(0, Number(entry.changeCount) || 0),
      reason: entry.reason || "일정 변경",
      changes: Array.isArray(entry.changes) ? entry.changes.filter(Boolean) : [],
      date: entry.date || TODAY,
      createdAt: entry.createdAt || "",
      schedule: snapshotSchedule(entry.schedule)
    }))
    : [];
}

function getScheduleVersionHistory(project) {
  const history = normalizeScheduleVersionHistory(project?.scheduleVersionHistory);
  if (history.length > 0) return history;
  return [{
    id: "initial_schedule_version",
    version: INITIAL_SCHEDULE_VERSION,
    previousVersion: "",
    changeCount: 0,
    reason: "최초 일정 기준",
    changes: [],
    date: project?.start || TODAY,
    createdAt: "",
    schedule: snapshotSchedule(project?.tasks)
  }];
}

function withScheduleVersionUpdate(project, nextProject, { changeCount, reason, changes = [] }) {
  const count = Math.max(1, Number(changeCount) || 1);
  const previousVersion = formatScheduleVersion(project.scheduleVersion);
  const nextVersion = nextScheduleVersion(previousVersion, count);
  const currentHistory = normalizeScheduleVersionHistory(project.scheduleVersionHistory);
  const baseHistory = currentHistory.length > 0
    ? currentHistory
    : [{
      id: `schedule_version_initial_${project.id || Date.now()}`,
      version: INITIAL_SCHEDULE_VERSION,
      previousVersion: "",
      changeCount: 0,
      reason: "최초 일정 기준",
      changes: [],
      date: project.start || TODAY,
      createdAt: "",
      schedule: snapshotSchedule(project.tasks)
    }];

  return {
    ...nextProject,
    scheduleVersion: nextVersion,
    scheduleVersionHistory: [
      ...baseHistory,
      {
        id: `schedule_version_${Date.now()}_${Math.random()}`,
        version: nextVersion,
        previousVersion,
        changeCount: count,
        reason: reason || "일정 변경",
        changes: changes.filter(Boolean),
        date: TODAY,
        createdAt: new Date().toISOString(),
        schedule: snapshotSchedule(nextProject.tasks)
      }
    ]
  };
}

function formatOwners(project) {
  const pm = (project?.pmName || "").trim();
  const am = (project?.amName || "").trim();
  const chunks = [];
  if (pm) chunks.push(`PM ${pm}`);
  if (am) chunks.push(`AM ${am}`);
  if (chunks.length > 0) return chunks.join(" / ");
  return project?.manager || "미정";
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
    return { text: "진행 중인 단계를 찾지 못했습니다.", isLate: false };
  }
  const daysLeft = diff(TODAY, task.scheduledEnd || TODAY);
  if (daysLeft >= 0) {
    return {
      text: `해당 단계 완료까지 ${daysLeft}일 남았습니다. 문제없이 진행되고 있나요?`,
      isLate: false
    };
  }
  return {
    text: `해당 단계 완료 예정일이 ${Math.abs(daysLeft)}일 지났습니다. 지연 사유를 확인해주세요.`,
    isLate: true
  };
}

function toPositiveInt(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.round(n));
}

function durationFromDates(startDate, endDate, fallback = 1) {
  const days = diff(startDate, endDate);
  if (!Number.isFinite(days)) return toPositiveInt(fallback, 1);
  return Math.max(1, days);
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

  const sourceOrderIds = normalizedSourceTasks.map((task) => task.id);
  const byId = Object.fromEntries(normalizedSourceTasks.map((task) => [task.id, task]));
  let structureChanged = migratedFromLegacy;
  const normalizedPhaseTasks = PHASES.map((template) => {
    const existing = byId[template.id];
    if (!existing) structureChanged = true;

    const duration = toPositiveInt(existing?.duration, template.duration);
    const task = {
      ...template,
      ...(existing || {}),
      id: template.id,
      name: existing?.name || template.name,
      cat: template.cat,
      icon: existing?.icon || template.icon,
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
  const phaseTaskById = Object.fromEntries(normalizedPhaseTasks.map((task) => [task.id, task]));
  const extraTaskById = Object.fromEntries(extraTasks.map((task) => [task.id, task]));
  const orderedTasks = sourceOrderIds
    .map((id) => phaseTaskById[id] || extraTaskById[id])
    .filter(Boolean);
  const missingPhaseTasks = normalizedPhaseTasks.filter((task) => !sourceOrderIds.includes(task.id));
  const finalTasks = [...orderedTasks, ...missingPhaseTasks];

  const hasMissingSchedule = normalizedPhaseTasks.some((task) => !task.scheduledStart || !task.scheduledEnd || !task.originalStart || !task.originalEnd);
  const startDate = project.start || TODAY;

  let phaseTasksWithSchedule = normalizedPhaseTasks;
  if (structureChanged || hasMissingSchedule) {
    const schedule = calcSchedule(normalizedPhaseTasks, startDate);
    phaseTasksWithSchedule = normalizedPhaseTasks.map((task) => ({
      ...task,
      scheduledStart: schedule[task.id].start,
      scheduledEnd: schedule[task.id].end,
      originalStart: task.originalStart || schedule[task.id].start,
      originalEnd: task.originalEnd || schedule[task.id].end
    }));
  }

  const phaseTaskMap = Object.fromEntries(phaseTasksWithSchedule.map((task) => [task.id, task]));
  const finalOrderedTasks = finalTasks.map((task) => phaseTaskMap[task.id] || task);
  const developTask = phaseTaskMap[DEVELOP_TASK_ID] || PHASE_TEMPLATE_BY_ID[DEVELOP_TASK_ID];
  const developSubTimeline = normalizeDevelopSubTimeline(project.developSubTimeline, developTask.duration);
  const projectCore = { ...project };
  delete projectCore.productSupplySheet;
  delete projectCore.permitCompany;
  delete projectCore.manufacturer;
  const projectCategory = project.category || "건강기능식품";

  return {
    ...projectCore,
    pmName: (project.pmName || "").trim(),
    amName: (project.amName || "").trim(),
    manager: project.manager || [project.pmName, project.amName].filter(Boolean).join(" / ") || "미정",
    category: projectCategory,
    regulatoryDirection: isOtcEtcCategory(projectCategory) ? normalizeRegulatoryDirection(project.regulatoryDirection) : "",
    exclusivityType: isOtcEtcCategory(projectCategory) ? normalizeExclusivityType(project.exclusivityType) : "",
    start: startDate,
    tasks: finalOrderedTasks,
    developSubTimeline,
    communicationLog: Array.isArray(project.communicationLog) ? project.communicationLog : [],
    decisionLog: Array.isArray(project.decisionLog) ? project.decisionLog : [],
    advisorLog: Array.isArray(project.advisorLog) ? project.advisorLog : [],
    stageCheckLog: Array.isArray(project.stageCheckLog) ? project.stageCheckLog : [],
    changeLog: Array.isArray(project.changeLog) ? project.changeLog : [],
    scheduleVersion: formatScheduleVersion(project.scheduleVersion),
    scheduleVersionHistory: normalizeScheduleVersionHistory(project.scheduleVersionHistory),
    draftChecklist: normalizeDraftChecklist(project.draftChecklist)
  };
}

function normalizeProjects(projects) {
  return (projects || []).map(normalizeProject);
}

function normalizeAdminLogs(logs) {
  return (logs || [])
    .filter((log) => log && typeof log === "object")
    .map((log) => {
      const normalized = {
        id: log.id || Date.now() + Math.floor(Math.random() * 1000),
        type: log.type || "project_event",
        projectId: log.projectId ?? null,
        projectName: log.projectName || "-",
        reason: log.reason || "",
        actor: log.actor || "관리자",
        createdAt: log.createdAt || new Date().toISOString(),
        hiddenForManager: Boolean(log.hiddenForManager)
      };
      if (normalized.type !== DASHBOARD_CHANGE_NOTICE_TYPE) return normalized;

      const changes = Array.isArray(log.changes)
        ? log.changes.map((change) => String(change || "").trim()).filter(Boolean)
        : String(log.reason || "").split(/\r?\n/).map((change) => change.trim()).filter(Boolean);
      return {
        ...normalized,
        projectId: null,
        projectName: "제품개발 대시보드",
        revision: String(log.revision || "").trim(),
        changeDate: String(log.changeDate || log.createdAt || "").slice(0, 10),
        changes,
        reason: changes.join("\n"),
        updatedAt: String(log.updatedAt || "")
      };
    });
}

function upsertById(items = [], nextItem) {
  const nextId = String(nextItem?.id ?? "");
  const exists = items.some((item) => String(item?.id ?? "") === nextId);
  if (!exists) return [...items, nextItem];
  return items.map((item) => (String(item?.id ?? "") === nextId ? { ...item, ...nextItem } : item));
}

function canManage(role) {
  return role === ROLE_ADMIN;
}

function errorMessage(error, fallback = "알 수 없는 오류") {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || fallback;
  return String(error?.message || error || fallback);
}

function readLocalCacheState() {
  if (typeof window === "undefined") {
    return {
      projects: [],
      adminLogs: [],
      supplyPriceItems: [],
      marketAnalysisDefaults: normalizeMarketAnalysisDefaults(),
      hasData: false
    };
  }
  try {
    const cached = window.localStorage.getItem(LOCAL_CACHE_KEY);
    if (!cached) return { projects: [], adminLogs: [], supplyPriceItems: [], hasData: false };
    const parsed = JSON.parse(cached);
    const projects = Array.isArray(parsed)
      ? normalizeProjects(parsed)
      : normalizeProjects(Array.isArray(parsed?.projects) ? parsed.projects : []);
    const adminLogs = Array.isArray(parsed)
      ? []
      : normalizeAdminLogs(Array.isArray(parsed?.adminLogs) ? parsed.adminLogs : []);
    const supplyPriceItems = Array.isArray(parsed)
      ? []
      : normalizeSupplyPriceItems(Array.isArray(parsed?.supplyPriceItems) ? parsed.supplyPriceItems : []);
    const marketAnalysisDefaults = Array.isArray(parsed)
      ? normalizeMarketAnalysisDefaults()
      : normalizeMarketAnalysisDefaults(parsed?.marketAnalysisDefaults);
    return {
      projects,
      adminLogs,
      supplyPriceItems,
      marketAnalysisDefaults,
      hasData: projects.length > 0
        || adminLogs.length > 0
        || supplyPriceItems.length > 0
        || Boolean(parsed?.marketAnalysisDefaults)
    };
  } catch {
    return {
      projects: [],
      adminLogs: [],
      supplyPriceItems: [],
      marketAnalysisDefaults: normalizeMarketAnalysisDefaults(),
      hasData: false
    };
  }
}

function summarizeDraftChecklistChanges(before = {}, after = {}) {
  const prev = normalizeDraftChecklist(before);
  const next = normalizeDraftChecklist(after);
  return DRAFT_CHECKLIST_FIELDS
    .filter((field) => (prev[field.key] || "").trim() !== (next[field.key] || "").trim())
    .map((field) => `${field.label} 수정`);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

const SAFE_ATTACHMENT_EXTENSIONS = new Set([
  "pdf", "png", "jpg", "jpeg", "webp", "doc", "docx", "xls", "xlsx", "csv", "txt"
]);
const SAFE_ATTACHMENT_TYPES = new Set([
  "",
  "application/octet-stream",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/csv",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);

function isSafeAttachmentFile(file) {
  const extension = String(file?.name || "").split(".").pop().toLowerCase();
  return SAFE_ATTACHMENT_EXTENSIONS.has(extension)
    && SAFE_ATTACHMENT_TYPES.has(String(file?.type || "").toLowerCase());
}

function formatBytes(size = 0) {
  const value = Number(size) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeSupplyAttachment(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    name: String(value.name || ""),
    type: String(value.type || ""),
    size: Number(value.size || 0),
    dataUrl: String(value.dataUrl || ""),
    uploadedAt: String(value.uploadedAt || "")
  };
}

const SUPPLY_PRICE_CATEGORIES = [
  { id: "OTC", label: "OTC", color: "#0ea5e9" },
  { id: "건강기능식품", label: "건강기능식품", color: "#10b981" },
  { id: "일반식품", label: "일반식품", color: "#f59e0b" },
  { id: "의약외품", label: "의약외품", color: "#8b5cf6" },
  { id: "기타", label: "기타", color: "#64748b" }
];
const DEFAULT_SUPPLY_PRICE_CATEGORY = SUPPLY_PRICE_CATEGORIES[0].id;
const MISC_SUPPLY_PRICE_CATEGORY = SUPPLY_PRICE_CATEGORIES[SUPPLY_PRICE_CATEGORIES.length - 1].id;
const SUPPLY_PRICE_CATEGORY_LABEL_BY_ID = Object.fromEntries(SUPPLY_PRICE_CATEGORIES.map((category) => [category.id, category.label]));

function normalizeSupplyCategory(value) {
  const raw = String(value || "").trim();
  if (SUPPLY_PRICE_CATEGORIES.some((category) => category.id === raw)) return raw;
  return raw ? MISC_SUPPLY_PRICE_CATEGORY : DEFAULT_SUPPLY_PRICE_CATEGORY;
}

function getSupplyQuoteMonth(value) {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}/.test(raw) ? raw.slice(0, 7) : "";
}

function getRecentSupplyQuoteRange(months) {
  const end = new Date();
  const targetMonthIndex = end.getMonth() - months;
  const targetYear = end.getFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastTargetDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const start = new Date(targetYear, targetMonth, Math.min(end.getDate(), lastTargetDay));
  return { from: toStr(start), to: toStr(end) };
}

function isSupplyQuoteOlderThanMonths(value, months = 6) {
  const quoteDate = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(quoteDate)) return false;
  return quoteDate < getRecentSupplyQuoteRange(months).from;
}

function parseSupplyPriceNumber(value) {
  const cleaned = String(value || "").replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatVatIncludedPrice(value) {
  const price = parseSupplyPriceNumber(value);
  if (price === null) return "";
  return `${supplyPriceFormat.format(price * 1.1)}원`;
}

function formatTotalPrice(value, quantity, multiplier = 1) {
  const price = parseSupplyPriceNumber(value);
  const count = parseSupplyPriceNumber(quantity);
  if (price === null || count === null) return "";
  return `${supplyPriceFormat.format(price * multiplier * count)}원`;
}

function formatPermitFeeIncludedTotalPrice(value, quantity, rate) {
  const price = parseSupplyPriceNumber(value);
  const count = parseSupplyPriceNumber(quantity);
  const percentage = parseSupplyPriceNumber(rate);
  if (price === null || count === null || percentage === null) return "";
  return `${supplyPriceFormat.format(price * count * 1.1 * (1 + (percentage / 100)))}원`;
}

function normalizeSupplyCheckedValue(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return ["1", "true", "yes", "y", "on"].includes(value.trim().toLowerCase());
  return false;
}

function isRawMaterialSupplyCategory(category) {
  return ["건강기능식품", "일반식품"].includes(normalizeSupplyCategory(category));
}

function isPermitCompanyFeeCategory(category) {
  return normalizeSupplyCategory(category) === "OTC";
}

function normalizeSupplyIngredient(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    name: String(source.name || source.ingredientName || ""),
    content: String(source.content || source.ingredientContent || ""),
    origin: String(source.origin || source.ingredientOrigin || ""),
    brand: String(source.brand || source.ingredientBrand || ""),
    kilogramPriceRange: String(source.kilogramPriceRange || source.kgPriceRange || source.pricePerKg || "")
  };
}

function normalizeSupplyIngredients(item = {}) {
  const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
  const ingredients = Array.isArray(source.ingredients)
    ? source.ingredients.map(normalizeSupplyIngredient)
    : [
        normalizeSupplyIngredient({
          name: source.ingredientName || "",
          content: source.ingredientContent || ""
        })
      ];
  return ingredients.length > 0 ? ingredients : [normalizeSupplyIngredient()];
}

function normalizeDistributionCompetitor(value = {}, fallbackId = "competitor_1") {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const priceTiers = (Array.isArray(source.priceTiers) ? source.priceTiers : [])
    .filter((tier) => tier && typeof tier === "object")
    .map((tier, index) => ({
      id: tier.id ?? `${fallbackId}_price_${index + 1}`,
      label: String(tier.label ?? ""),
      price: String(tier.price ?? "")
    }));
  if (priceTiers.length === 0 && source.salePrice !== undefined && source.salePrice !== null && String(source.salePrice).trim()) {
    priceTiers.push({
      id: `${fallbackId}_price_1`,
      label: "기본",
      price: String(source.salePrice)
    });
  }
  return {
    id: source.id ?? fallbackId,
    date: String(source.date || ""),
    productName: String(source.productName || ""),
    salesChannel: String(source.salesChannel || source.seller || source.salesPlace || ""),
    packagingUnit: String(source.packagingUnit || ""),
    salePrice: String(source.salePrice ?? priceTiers[0]?.price ?? ""),
    priceTiers,
    memo: String(source.memo || source.note || "")
  };
}

function normalizeDistributionPricingScenario(value = {}, fallbackId = "pricing_default", fallbackLabel = "기본") {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    id: source.id ?? fallbackId,
    label: String(source.label || fallbackLabel),
    minimumQuantity: String(source.minimumQuantity ?? source.minQuantity ?? ""),
    chamyaksaMarginRate: String(source.chamyaksaMarginRate ?? ""),
    pharmacySellingPrice: String(source.pharmacySellingPrice ?? "")
  };
}

function normalizeDistributionStructure(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const pricingScenarios = (Array.isArray(source.pricingScenarios) ? source.pricingScenarios : [])
    .filter((scenario) => scenario && typeof scenario === "object")
    .map((scenario, index) => normalizeDistributionPricingScenario(
      scenario,
      `pricing_${index + 1}`,
      index === 0 ? "기본" : `가격대 ${index + 1}`
    ));
  if (pricingScenarios.length === 0) {
    pricingScenarios.push(normalizeDistributionPricingScenario({
      id: "pricing_default",
      label: "기본",
      minimumQuantity: "",
      chamyaksaMarginRate: source.chamyaksaMarginRate,
      pharmacySellingPrice: source.pharmacySellingPrice
    }));
  }
  return {
    pricingScenarios,
    competitors: (Array.isArray(source.competitors) ? source.competitors : [])
      .filter((competitor) => competitor && typeof competitor === "object")
      .map((competitor, index) => normalizeDistributionCompetitor(competitor, `competitor_${index + 1}`)),
    updatedAt: String(source.updatedAt || "")
  };
}

function normalizeSupplyPriceItem(item = {}, fallbackId = Date.now()) {
  const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
  const id = source.id ?? fallbackId;
  const category = normalizeSupplyCategory(source.category || source.supplyCategory || source.productCategory);
  const supportsPermitCompanyFee = isPermitCompanyFeeCategory(category);
  return {
    id,
    category,
    manufacturer: String(source.manufacturer || ""),
    permitCompany: supportsPermitCompanyFee
      ? String(source.permitCompany || source.licenseCompany || source.approvalCompany || "")
      : "",
    ingredients: normalizeSupplyIngredients(source),
    packagingUnit: String(source.packagingUnit || source.packageUnit || ""),
    packagingForm: String(source.packagingForm || source.packageForm || ""),
    quantity: String(source.quantity || source.supplyQuantity || source.qty || ""),
    minimumOrderBatchQuantity: String(
      source.minimumOrderBatchQuantity || source.minOrderBatchQuantity || source.minimumBatchQuantity || source.moq || ""
    ),
    supplyUnitPrice: String(source.supplyUnitPrice || ""),
    vatIncluded: normalizeSupplyCheckedValue(source.vatIncluded ?? source.includeVat ?? source.hasVat),
    permitCompanyFee: supportsPermitCompanyFee && normalizeSupplyCheckedValue(
      source.permitCompanyFee ?? source.licenseCompanyFee ?? source.approvalCompanyFee ?? source.authorizationCompanyFee
    ),
    permitCompanyFeeRate: supportsPermitCompanyFee
      ? String(source.permitCompanyFeeRate || source.licenseCompanyFeeRate || source.approvalCompanyFeeRate || "")
      : "",
    permitCompanyFeeRateUnknown: supportsPermitCompanyFee && normalizeSupplyCheckedValue(
      source.permitCompanyFeeRateUnknown ?? source.licenseCompanyFeeRateUnknown ?? source.approvalCompanyFeeRateUnknown
    ),
    quoteDate: String(source.quoteDate || ""),
    shelfLife: String(source.shelfLife || source.expirationPeriod || source.expiryPeriod || ""),
    memo: String(source.memo || ""),
    quoteAdoptionExpected: normalizeSupplyCheckedValue(
      source.quoteAdoptionExpected ?? source.expectedAdoption ?? source.quoteExpectedToAdopt
    ),
    attachment: normalizeSupplyAttachment(source.attachment),
    distributionStructure: normalizeDistributionStructure(source.distributionStructure),
    marketSizeAnalysis: normalizeMarketSizeAnalysis(source.marketSizeAnalysis),
    createdAt: String(source.createdAt || new Date().toISOString()),
    updatedAt: String(source.updatedAt || "")
  };
}

function normalizeSupplyPriceItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && typeof item === "object")
    .map((item, index) => normalizeSupplyPriceItem(item, item.id ?? `supply_price_${index + 1}`));
}

function isSupplyPriceItemEmpty(item = {}) {
  const ingredientHasValue = (Array.isArray(item.ingredients) ? item.ingredients : []).some((ingredient) => (
    [
      ingredient?.name,
      ingredient?.content,
      ingredient?.origin,
      ingredient?.brand,
      ingredient?.kilogramPriceRange
    ].some((value) => String(value || "").trim())
  ));
  const fieldHasValue = [
    item.manufacturer,
    item.permitCompany,
    item.packagingUnit,
    item.packagingForm,
    item.quantity,
    item.minimumOrderBatchQuantity,
    item.supplyUnitPrice,
    item.permitCompanyFeeRate,
    item.quoteDate,
    item.shelfLife,
    item.memo,
    item.attachment?.name
  ].some((value) => String(value || "").trim());
  return !ingredientHasValue
    && !fieldHasValue
    && !item.vatIncluded
    && !item.permitCompanyFee
    && !item.quoteAdoptionExpected;
}

function createSupplyPriceItem() {
  return normalizeSupplyPriceItem({
    id: Date.now(),
    createdAt: new Date().toISOString()
  });
}

function useProjectsStore() {
  const [projects, setProjects] = useState(() => {
    return readLocalCacheState().projects;
  });

  const [adminLogs, setAdminLogs] = useState(() => {
    return readLocalCacheState().adminLogs;
  });

  const [supplyPriceItems, setSupplyPriceItems] = useState(() => {
    return readLocalCacheState().supplyPriceItems;
  });

  const [marketAnalysisDefaults, setMarketAnalysisDefaults] = useState(() => {
    return readLocalCacheState().marketAnalysisDefaults;
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
          const localCache = readLocalCacheState();
          const nextProjects = normalizeProjects(Array.isArray(payload.projects) ? payload.projects : []);
          const nextAdminLogs = normalizeAdminLogs(Array.isArray(payload.adminLogs) ? payload.adminLogs : []);
          const nextSupplyPriceItems = normalizeSupplyPriceItems(Array.isArray(payload.supplyPriceItems) ? payload.supplyPriceItems : []);
          const nextMarketAnalysisDefaults = normalizeMarketAnalysisDefaults(payload.marketAnalysisDefaults);
          const serverIsEmpty = nextProjects.length === 0 && nextAdminLogs.length === 0 && nextSupplyPriceItems.length === 0;
          if (serverIsEmpty && localCache.hasData) {
            setProjects(localCache.projects);
            setAdminLogs(localCache.adminLogs);
            setSupplyPriceItems(localCache.supplyPriceItems);
            setMarketAnalysisDefaults(localCache.marketAnalysisDefaults);
            serverAvailableRef.current = true;
            setSyncState({
              status: "warning",
              message: "서버 DB가 비어 있어 이 브라우저의 로컬 캐시를 복구 대상으로 사용합니다. 곧 서버에 다시 저장합니다."
            });
            readyRef.current = true;
            return;
          }
          setProjects(nextProjects);
          setAdminLogs(nextAdminLogs);
          setSupplyPriceItems(nextSupplyPriceItems);
          setMarketAnalysisDefaults(nextMarketAnalysisDefaults);
          serverAvailableRef.current = true;
          setSyncState({
            status: "ready",
            message: payload.source === "seeded" ? "서버 초기 데이터 로드 완료" : "서버 기존 데이터 로드 완료"
          });
          readyRef.current = true;
        }
      } catch (error) {
        const reason = errorMessage(error, "서버 연결 실패");
        if (!disposed) {
          const fallbackProjects = normalizeProjects(getInitialProjects());
          setProjects((prev) => (prev.length ? normalizeProjects(prev) : fallbackProjects));
          setAdminLogs((prev) => normalizeAdminLogs(prev));
          setSupplyPriceItems((prev) => normalizeSupplyPriceItems(prev));
          setMarketAnalysisDefaults((prev) => normalizeMarketAnalysisDefaults(prev));
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
      window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({
        projects,
        adminLogs,
        supplyPriceItems,
        marketAnalysisDefaults,
        cachedAt: new Date().toISOString()
      }));
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
          body: JSON.stringify({ projects, adminLogs, supplyPriceItems, marketAnalysisDefaults })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || payload.message || `저장 실패 (${response.status})`);
        }
        setSyncState({ status: "saved", message: `저장 완료 (${new Date(payload.updatedAt).toLocaleString()})` });
      } catch (error) {
        serverAvailableRef.current = true;
        setSyncState({
          status: "warning",
          message: `서버 저장 실패 (${errorMessage(error, "원인 확인 필요")}): 이 브라우저 로컬 캐시에 보관했고 다음 변경 시 서버 저장을 재시도합니다.`
        });
      }
    }, 700);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [projects, adminLogs, supplyPriceItems, marketAnalysisDefaults]);

  return {
    projects,
    setProjects,
    adminLogs,
    setAdminLogs,
    supplyPriceItems,
    setSupplyPriceItems,
    marketAnalysisDefaults,
    setMarketAnalysisDefaults,
    syncState
  };
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
  const [icon, setIcon] = useState(task.icon || "");
  const [progress, setProgress] = useState(task.progress || 0);
  const [notes, setNotes] = useState(task.notes || "");
  const [delayDays, setDelayDays] = useState(0);
  const [duration, setDuration] = useState(task.duration || 1);
  const [startDate, setStartDate] = useState(task.scheduledStart || TODAY);
  const [endDate, setEndDate] = useState(task.scheduledEnd || TODAY);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 640, maxWidth: "92vw", borderRadius: 14, background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,.2)", padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{task.icon} {task.name}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 19 }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: "#475569", background: "#f8fafc", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
          일정: {fmt(task.scheduledStart)} ~ {fmt(task.scheduledEnd)} ({task.duration}일)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "112px 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>이모지</label>
            <input
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
              maxLength={8}
              style={{ ...inputStyle, textAlign: "center", fontSize: 18 }}
              aria-label="태스크 이모지"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700 }}>진행률 ({progress}%)</label>
            <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} style={{ width: "100%" }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>지연 적용 (일)</label>
            <input type="number" value={delayDays} min={0} onChange={(e) => setDelayDays(Number(e.target.value))} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>기간 변경 (일)</label>
            <input type="number" value={duration} min={1} onChange={(e) => setDuration(Number(e.target.value))} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>시작일 지정</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>완료일 지정</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>메모</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer" }}>취소</button>
          <button
            onClick={() => {
              const nextDuration = toPositiveInt(duration, task.duration || 1);
              const durationChanged = nextDuration !== task.duration;
              const endDateWasEdited = endDate !== (task.scheduledEnd || TODAY);
              const nextEndDate = durationChanged && !endDateWasEdited
                ? toStr(addDays(startDate || task.scheduledStart, nextDuration))
                : endDate;
              onSave({
                icon: icon.trim() || task.icon,
                progress,
                notes,
                delayDays,
                startDate,
                endDate: nextEndDate,
                duration: nextDuration
              });
            }}
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
        <div style={{ padding: "11px 14px", borderBottom: "1px solid #e2e8f0", fontWeight: 800 }}>간트 차트</div>
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
                    {Number(d.slice(5, 7))}월
                  </div>
                );
              })}
              {yearTicks.map((d) => {
                const x = leftPct(d);
                return (
                  <div key={`year-${d}`} style={{ position: "absolute", left: `${x}%`, top: 1, transform: "translateX(2px)", fontSize: 10, color: "#334155", fontWeight: 900 }}>
                    {d.slice(0, 4)}년
                  </div>
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

function TasksTab({
  project,
  onTaskStatusChange,
  onScheduleCommit,
  forcedEditTaskId,
  onForcedEditHandled
}) {
  const cloneTasks = (tasks = []) => tasks.map((task) => ({ ...task, pred: [...(task.pred || [])] }));
  const [isEditing, setIsEditing] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [draftTasks, setDraftTasks] = useState(() => cloneTasks(project.tasks));
  const [draftProjectStart, setDraftProjectStart] = useState(project.start || TODAY);
  const [draftDevelopTimeline, setDraftDevelopTimeline] = useState(() => (
    normalizeDevelopSubTimeline(project.developSubTimeline, toPositiveInt(project.tasks.find((task) => task.id === DEVELOP_TASK_ID)?.duration, 1))
  ));
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({
    name: "",
    cat: "기타",
    start: project.start || TODAY,
    end: toStr(addDays(project.start || TODAY, 7))
  });
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [dragOverPosition, setDragOverPosition] = useState(null);
  const tasks = isEditing ? draftTasks : project.tasks;
  const developTask = tasks.find((task) => task.id === DEVELOP_TASK_ID);
  const developDuration = toPositiveInt(developTask?.duration, 1);
  const developTimeline = developTask
    ? normalizeDevelopSubTimeline(isEditing ? draftDevelopTimeline : project.developSubTimeline, developDuration)
    : [];

  useEffect(() => {
    if (isEditing) return;
    setDraftTasks(cloneTasks(project.tasks));
    setDraftProjectStart(project.start || TODAY);
    setDraftDevelopTimeline(normalizeDevelopSubTimeline(
      project.developSubTimeline,
      toPositiveInt(project.tasks.find((task) => task.id === DEVELOP_TASK_ID)?.duration, 1)
    ));
    setNewTask({
      name: "",
      cat: "기타",
      start: project.start || TODAY,
      end: toStr(addDays(project.start || TODAY, 7))
    });
    setShowAddTask(false);
  }, [isEditing, project.developSubTimeline, project.id, project.start, project.tasks]);

  useEffect(() => {
    if (!forcedEditTaskId) return;
    const target = (project.tasks || []).find((task) => task.id === forcedEditTaskId);
    if (target) {
      if (!isEditing) {
        setDraftTasks(cloneTasks(project.tasks));
        setDraftProjectStart(project.start || TODAY);
        setDraftDevelopTimeline(normalizeDevelopSubTimeline(project.developSubTimeline, toPositiveInt(project.tasks.find((task) => task.id === DEVELOP_TASK_ID)?.duration, 1)));
        setIsEditing(true);
      }
      setEditTask(target);
    }
    if (onForcedEditHandled) onForcedEditHandled();
  }, [forcedEditTaskId, isEditing, onForcedEditHandled, project.developSubTimeline, project.start, project.tasks]);

  const beginEditing = () => {
    setDraftTasks(cloneTasks(project.tasks));
    setDraftProjectStart(project.start || TODAY);
    setDraftDevelopTimeline(normalizeDevelopSubTimeline(project.developSubTimeline, toPositiveInt(project.tasks.find((task) => task.id === DEVELOP_TASK_ID)?.duration, 1)));
    setNewTask({
      name: "",
      cat: "기타",
      start: project.start || TODAY,
      end: toStr(addDays(project.start || TODAY, 7))
    });
    setShowAddTask(false);
    setIsEditing(true);
  };

  const updateDraftTask = (taskId, updater) => {
    setDraftTasks((prev) => prev.map((task) => (
      task.id === taskId ? updater(task) : task
    )));
  };

  const updateDraftTaskDates = (taskId, field, value) => {
    updateDraftTask(taskId, (task) => {
      const next = { ...task, [field]: value };
      return { ...next, duration: durationFromDates(next.scheduledStart, next.scheduledEnd, task.duration || 1) };
    });
  };

  const applyTaskDetailPatch = (task, patch) => {
    updateDraftTask(task.id, (currentTask) => {
      const hasStartPatch = Boolean(patch.startDate);
      const hasEndPatch = Boolean(patch.endDate);
      const hasDurationPatch = typeof patch.duration === "number";
      const nextStart = hasStartPatch ? toStr(patch.startDate) : currentTask.scheduledStart;
      let nextEnd = hasEndPatch ? toStr(patch.endDate) : currentTask.scheduledEnd;
      let nextDuration = hasDurationPatch ? toPositiveInt(patch.duration, currentTask.duration || 1) : currentTask.duration;

      if (hasDurationPatch && !hasEndPatch) nextEnd = toStr(addDays(nextStart, nextDuration));
      if ((patch.delayDays || 0) > 0) nextEnd = toStr(addDays(nextEnd, patch.delayDays));
      nextDuration = durationFromDates(nextStart, nextEnd, nextDuration);

      return {
        ...currentTask,
        icon: patch.icon ?? currentTask.icon,
        progress: patch.progress ?? currentTask.progress,
        notes: patch.notes ?? currentTask.notes,
        duration: nextDuration,
        scheduledStart: nextStart,
        scheduledEnd: nextEnd
      };
    });
  };

  const saveDevelopItem = (itemId, field, value) => {
    if (!developTask) return;
    const numeric = Number(value);
    const raw = developTimeline.map((item) => (
      item.id === itemId ? { ...item, [field]: Number.isFinite(numeric) ? numeric : item[field] } : item
    ));
    setDraftDevelopTimeline(normalizeDevelopSubTimeline(raw, developDuration));
  };
  const toggleDevelopItem = (itemId) => {
    const raw = developTimeline.map((item) => (
      item.id === itemId ? { ...item, enabled: item.enabled === false ? true : false } : item
    ));
    setDraftDevelopTimeline(normalizeDevelopSubTimeline(raw, developDuration));
  };

  const saveNewTask = () => {
    const name = newTask.name.trim();
    if (!name) {
      window.alert("태스크명을 입력해주세요.");
      return;
    }
    const start = newTask.start || draftProjectStart || TODAY;
    const end = newTask.end || toStr(addDays(start, 1));
    const cat = newTask.cat || "기타";
    const taskId = `custom_${Date.now()}`;
    setDraftTasks((prev) => [...prev, {
      id: taskId,
      name,
      cat,
      icon: "📌",
      color: CAT_COLORS[cat] || "#64748b",
      duration: durationFromDates(start, end, 1),
      pred: [],
      scheduledStart: start,
      scheduledEnd: end,
      originalStart: start,
      originalEnd: end,
      progress: 0,
      isEnabled: true,
      vendorName: "",
      taskStatus: "pending",
      notes: ""
    }]);
    setNewTask({
      name: "",
      cat: "기타",
      start: draftProjectStart || TODAY,
      end: toStr(addDays(draftProjectStart || TODAY, 7))
    });
    setShowAddTask(false);
  };

  const moveTask = (fromId, toId, position = "before") => {
    if (!fromId || !toId || fromId === toId) return;
    const ids = draftTasks.map((task) => task.id);
    const fromIndex = ids.indexOf(fromId);
    const toIndex = ids.indexOf(toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextIds = ids.filter((id) => id !== fromId);
    const targetIndex = nextIds.indexOf(toId);
    if (targetIndex < 0) return;
    const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
    nextIds.splice(insertIndex, 0, fromId);
    if (nextIds.every((id, index) => id === ids[index])) return;
    const taskById = Object.fromEntries(draftTasks.map((task) => [task.id, task]));
    setDraftTasks(nextIds.map((id) => taskById[id]).filter(Boolean));
  };

  const clearTaskDrag = () => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
    setDragOverPosition(null);
  };

  const getDraftChanges = () => {
    const originalById = Object.fromEntries((project.tasks || []).map((task) => [task.id, task]));
    const originalIds = (project.tasks || []).map((task) => task.id);
    const changes = [];
    let changeCount = 0;

    draftTasks.forEach((task) => {
      const original = originalById[task.id];
      if (!original) {
        changeCount += 1;
        changes.push(`${task.name} 태스크 추가`);
        return;
      }

      const parts = [];
      if (task.name !== original.name) parts.push("태스크명");
      if (task.icon !== original.icon) parts.push("이모지");
      if (task.scheduledStart !== original.scheduledStart) parts.push("시작일");
      if (task.scheduledEnd !== original.scheduledEnd) parts.push("완료일");
      if (task.duration !== original.duration) parts.push("기간");
      if ((task.vendorName || "") !== (original.vendorName || "")) parts.push("업체");
      if ((task.progress || 0) !== (original.progress || 0)) parts.push("진행률");
      if ((task.notes || "") !== (original.notes || "")) parts.push("메모");
      if (task.isEnabled !== original.isEnabled) parts.push(task.isEnabled === false ? "비활성화" : "활성화");
      if (parts.length > 0) {
        changeCount += 1;
        changes.push(`${task.name}: ${parts.join(", ")} 변경`);
      }
    });

    const draftExistingIds = draftTasks.map((task) => task.id).filter((id) => originalById[id]);
    if (draftExistingIds.join("|") !== originalIds.join("|")) {
      changeCount += 1;
      changes.push("태스크 행 순서 변경");
    }
    if (draftProjectStart !== project.start) {
      changeCount += 1;
      changes.push(`프로젝트 시작일 ${project.start} -> ${draftProjectStart}`);
    }
    const originalTimeline = normalizeDevelopSubTimeline(project.developSubTimeline, toPositiveInt(project.tasks.find((task) => task.id === DEVELOP_TASK_ID)?.duration, 1));
    if (JSON.stringify(draftDevelopTimeline) !== JSON.stringify(originalTimeline)) {
      changeCount += 1;
      changes.push("제품 개발 하단 타임라인 변경");
    }

    return { changeCount, changes };
  };

  const completeEditing = () => {
    const { changeCount, changes } = getDraftChanges();
    if (changeCount > 0) {
      onScheduleCommit({
        tasks: cloneTasks(draftTasks),
        start: draftProjectStart,
        developSubTimeline: normalizeDevelopSubTimeline(draftDevelopTimeline, developDuration),
        changeCount,
        changes
      });
    }
    setEditTask(null);
    setShowAddTask(false);
    setIsEditing(false);
  };

  const handleTaskStatusChange = (task, value) => {
    onTaskStatusChange(task, value);
    if (isEditing) updateDraftTask(task.id, (currentTask) => ({ ...currentTask, taskStatus: value }));
  };
  const scheduleHistory = getScheduleVersionHistory(project);

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800 }}>태스크 일정/진행</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
            일정 버전 <strong style={{ color: "#0f172a" }}>{formatScheduleVersion(project.scheduleVersion)}</strong>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isEditing && <>
            <button
              onClick={() => setShowAddTask((prev) => !prev)}
              style={{ padding: "6px 9px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
            >
              행 추가
            </button>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>프로젝트 시작일</span>
            <input type="date" value={draftProjectStart} onChange={(e) => setDraftProjectStart(e.target.value)} style={{ ...inputStyle, width: 150, padding: "6px 8px", fontSize: 12 }} />
          </>}
          {!isEditing && <span style={{ fontSize: 12, color: "#64748b" }}>프로젝트 시작일 {fmt(project.start)}</span>}
          <button
            onClick={isEditing ? completeEditing : beginEditing}
            style={{ ...primaryButton, padding: "7px 12px", fontSize: 12 }}
          >
            {isEditing ? "완료" : "수정"}
          </button>
        </div>
      </div>
      {isEditing && showAddTask && (
        <div style={{ padding: 14, borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 140px 150px 150px auto auto", gap: 8, alignItems: "end" }}>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4 }}>태스크명</label>
              <input
                value={newTask.name}
                onChange={(event) => setNewTask((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="새 태스크명"
                style={{ ...inputStyle, padding: "7px 9px", fontSize: 12 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4 }}>단계</label>
              <select
                value={newTask.cat}
                onChange={(event) => setNewTask((prev) => ({ ...prev, cat: event.target.value }))}
                style={{ ...inputStyle, padding: "7px 9px", fontSize: 12 }}
              >
                {PHASE_CATS.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4 }}>시작일</label>
              <input
                type="date"
                value={newTask.start}
                onChange={(event) => setNewTask((prev) => ({ ...prev, start: event.target.value }))}
                style={{ ...inputStyle, padding: "7px 9px", fontSize: 12 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 4 }}>완료일</label>
              <input
                type="date"
                value={newTask.end}
                onChange={(event) => setNewTask((prev) => ({ ...prev, end: event.target.value }))}
                style={{ ...inputStyle, padding: "7px 9px", fontSize: 12 }}
              />
            </div>
            <button onClick={saveNewTask} style={{ ...primaryButton, padding: "8px 12px", fontSize: 12 }}>
              추가
            </button>
            <button
              onClick={() => setShowAddTask(false)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
            >
              취소
            </button>
          </div>
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {["순서", "활성", "태스크", "시작일", "완료일", "업체(공급업체 예정)", "상태", "진행률", "메모", ""].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontSize: 11, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.flatMap((task, taskIndex) => {
            const enabled = task.isEnabled !== false;
            const isDragging = draggedTaskId === task.id;
            const isDragTarget = dragOverTaskId === task.id && draggedTaskId !== task.id;
            const isDragBefore = isDragTarget && dragOverPosition === "before";
            const isDragAfter = isDragTarget && dragOverPosition === "after";
            const rows = [
              <tr
                key={task.id}
                onDragOver={(event) => {
                  if (!isEditing) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const position = event.clientY - bounds.top < bounds.height / 2 ? "before" : "after";
                  if (dragOverTaskId !== task.id) setDragOverTaskId(task.id);
                  if (dragOverPosition !== position) setDragOverPosition(position);
                }}
                onDragLeave={() => {
                  if (!isEditing) return;
                  if (dragOverTaskId === task.id) {
                    setDragOverTaskId(null);
                    setDragOverPosition(null);
                  }
                }}
                onDrop={(event) => {
                  if (!isEditing) return;
                  event.preventDefault();
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const position = event.clientY - bounds.top < bounds.height / 2 ? "before" : "after";
                  const sourceId = event.dataTransfer.getData("application/x-pms-task") || event.dataTransfer.getData("text/plain") || draggedTaskId;
                  moveTask(sourceId, task.id, position);
                  clearTaskDrag();
                }}
                style={{
                  borderTop: isDragBefore ? "3px solid #2563eb" : "1px solid transparent",
                  borderBottom: isDragAfter ? "3px solid #2563eb" : "1px solid #f1f5f9",
                  opacity: enabled ? (isDragging ? 0.45 : 1) : 0.55,
                  background: isDragTarget ? "#eff6ff" : "#fff"
                }}
              >
                <td style={{ padding: "9px 12px", fontSize: 12, color: "#64748b" }}>
                  {isEditing ? (
                    <button
                      type="button"
                      draggable={enabled}
                      onDragStart={(event) => {
                        setDraggedTaskId(task.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("application/x-pms-task", task.id);
                        event.dataTransfer.setData("text/plain", task.id);
                      }}
                      onDragEnd={clearTaskDrag}
                      title="드래그해서 순서 변경"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: "#f8fafc",
                        cursor: enabled ? "grab" : "not-allowed",
                        userSelect: "none",
                        color: "#475569"
                      }}
                    >
                      ↕
                    </button>
                  ) : taskIndex + 1}
                </td>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>
                  {isEditing ? (
                    <button
                      onClick={() => updateDraftTask(task.id, (currentTask) => ({ ...currentTask, isEnabled: !enabled }))}
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
                  ) : (
                    <span style={{ color: enabled ? "#15803d" : "#94a3b8", fontWeight: 700 }}>{enabled ? "사용" : "미사용"}</span>
                  )}
                </td>
                <td style={{ padding: "9px 12px", fontSize: 13, fontWeight: 700 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 170 }}>
                    {isEditing ? <>
                      <input
                        value={task.icon || ""}
                        onChange={(event) => updateDraftTask(task.id, (currentTask) => ({ ...currentTask, icon: event.target.value }))}
                        maxLength={8}
                        title="태스크 이모지 수정"
                        aria-label={`${task.name} 이모지`}
                        style={{ ...inputStyle, flex: "0 0 40px", width: 40, padding: "4px", textAlign: "center", fontSize: 17 }}
                        disabled={!enabled}
                      />
                      <input
                        value={task.name}
                        onChange={(event) => updateDraftTask(task.id, (currentTask) => ({ ...currentTask, name: event.target.value }))}
                        style={{ ...inputStyle, width: "100%", minWidth: 130, padding: "5px 8px", fontSize: 12, fontWeight: 700 }}
                        disabled={!enabled}
                      />
                    </> : <span>{task.icon} {task.name}</span>}
                  </div>
                </td>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>
                  {isEditing ? (
                    <input
                      type="date"
                      value={task.scheduledStart}
                      onChange={(event) => updateDraftTaskDates(task.id, "scheduledStart", event.target.value)}
                      style={{ ...inputStyle, width: 140, padding: "5px 8px", fontSize: 12 }}
                      disabled={!enabled}
                    />
                  ) : fmt(task.scheduledStart)}
                </td>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>
                  {isEditing ? (
                    <input
                      type="date"
                      value={task.scheduledEnd}
                      onChange={(event) => updateDraftTaskDates(task.id, "scheduledEnd", event.target.value)}
                      style={{ ...inputStyle, width: 140, padding: "5px 8px", fontSize: 12 }}
                      disabled={!enabled}
                    />
                  ) : fmt(task.scheduledEnd)}
                </td>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>
                  {task.id === "supplier" ? (
                    isEditing ? (
                      <input
                        value={task.vendorName || ""}
                        onChange={(event) => updateDraftTask(task.id, (currentTask) => ({ ...currentTask, vendorName: event.target.value }))}
                        placeholder="예정 업체명 입력"
                        style={{ ...inputStyle, width: 180, padding: "5px 8px", fontSize: 12 }}
                        disabled={!enabled}
                      />
                    ) : <span style={{ color: task.vendorName ? "#334155" : "#94a3b8" }}>{task.vendorName || "-"}</span>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>-</span>
                  )}
                </td>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>
                  <select
                    value={task.taskStatus || "pending"}
                    onChange={(event) => handleTaskStatusChange(task, event.target.value)}
                    style={{ ...inputStyle, width: 110, padding: "5px 8px", fontSize: 12 }}
                    disabled={!enabled}
                  >
                    {Object.entries(STATUS_LABEL).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>{task.progress || 0}%</td>
                <td style={{ padding: "9px 12px", fontSize: 12, color: "#64748b", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.notes || "-"}</td>
                <td style={{ padding: "9px 12px" }}>
                  {isEditing && <button onClick={() => setEditTask(task)} style={{ padding: "6px 9px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 12 }} disabled={!enabled}>
                    수정
                  </button>}
                </td>
              </tr>
            ];

            if (task.id === DEVELOP_TASK_ID && developTask && enabled) {
              rows.push(
                <tr key={`${task.id}__subtimeline`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td colSpan={10} style={{ padding: "10px 12px 14px", background: "#f8fafc" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
                      제품 개발 하단 타임라인 (제품 개발 {developTask.duration}일)
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
                                {isEditing ? <button
                                  onClick={() => toggleDevelopItem(item.id)}
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
                                  title={enabled ? `${item.name} ON` : `${item.name} OFF`}
                                >
                                  <span style={{ width: 14, height: 14, borderRadius: 999, background: enabled ? "#16a34a" : "#94a3b8", display: "block" }} />
                                </button> : <span style={{ fontSize: 11, color: enabled ? "#15803d" : "#94a3b8" }}>{enabled ? "사용" : "미사용"}</span>}
                              </div>
                              {isEditing ? <input
                                type="number"
                                min={0}
                                value={item.startOffset}
                                onChange={(event) => saveDevelopItem(item.id, "startOffset", event.target.value)}
                                style={{ ...inputStyle, fontSize: 12, padding: "5px 8px" }}
                                title="시작 오프셋(일)"
                                disabled={!enabled}
                              /> : <div style={{ fontSize: 12, color: "#475569" }}>시작 +{item.startOffset}일</div>}
                              {isEditing ? <input
                                type="number"
                                min={1}
                                value={item.duration}
                                onChange={(event) => saveDevelopItem(item.id, "duration", event.target.value)}
                                style={{ ...inputStyle, fontSize: 12, padding: "5px 8px" }}
                                title="기간(일)"
                                disabled={!enabled}
                              /> : <div style={{ fontSize: 12, color: "#475569" }}>기간 {item.duration}일</div>}
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

      <div style={{ borderTop: "1px solid #e2e8f0", background: "#f8fafc", padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>일정 버전 이력</div>
        <div style={{ display: "grid", gap: 7 }}>
          {[...scheduleHistory].reverse().map((entry, index) => (
            <details key={entry.id} open={index === 0} style={{ border: "1px solid #dbe3ee", borderRadius: 8, background: "#fff", padding: "7px 10px" }}>
              <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#334155" }}>
                <strong style={{ color: "#1d4ed8" }}>{entry.version}</strong>
                <span>{entry.previousVersion ? `${entry.previousVersion} -> ${entry.version}` : "최초 일정"}</span>
                <span style={{ color: "#64748b" }}>{entry.changeCount ? `변경 ${entry.changeCount}건` : "기준 일정"}</span>
                <span style={{ color: "#64748b" }}>{fmt(entry.date)}</span>
              </summary>
              <div style={{ borderTop: "1px solid #eef2f7", marginTop: 7, paddingTop: 7, display: "grid", gap: 5 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{entry.reason}</div>
                {entry.changes.length > 0 && <div style={{ fontSize: 12, color: "#475569" }}>{entry.changes.join(" / ")}</div>}
                <div style={{ display: "grid", gap: 3, marginTop: 2 }}>
                  {entry.schedule.map((item) => (
                    <div key={`${entry.id}_${item.id}`} style={{ fontSize: 11, color: item.isEnabled ? "#475569" : "#94a3b8" }}>
                      {item.order}. {item.icon} {item.name} · {fmt(item.start)} ~ {fmt(item.end)} ({item.duration}일)
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>

      {editTask && (
        <TaskEditModal
          task={editTask}
          onClose={() => setEditTask(null)}
          onSave={(patch) => {
            applyTaskDetailPatch(editTask, patch);
            setEditTask(null);
          }}
        />
      )}
    </div>
  );
}

function SupplyPriceTab({
  items,
  onItemsChange,
  syncState,
  selectedCategory = "all",
  focusedItemId = null,
  onOpenDistribution,
  isAdmin = false
}) {
  const [search, setSearch] = useState("");
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [quickQuoteDateFilter, setQuickQuoteDateFilter] = useState("all");
  const [editingIds, setEditingIds] = useState(new Set());
  const [editSnapshots, setEditSnapshots] = useState({});
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isCsvExportDialogOpen, setIsCsvExportDialogOpen] = useState(false);
  const [exportCategoryIds, setExportCategoryIds] = useState(SUPPLY_PRICE_CATEGORIES.map((category) => category.id));
  const focusedScrollHandledRef = useRef(null);
  const pendingCopiedItemScrollRef = useRef(null);
  const safeItems = useMemo(() => normalizeSupplyPriceItems(items), [items]);
  const currentCategory = useMemo(() => (
    selectedCategory === "all" ? "all" : normalizeSupplyCategory(selectedCategory)
  ), [selectedCategory]);
  const categoryFilteredItems = useMemo(() => {
    if (currentCategory === "all") return safeItems;
    return safeItems.filter((item) => item.category === currentCategory);
  }, [currentCategory, safeItems]);
  const currentCategoryLabel = currentCategory === "all"
    ? "전체"
    : (SUPPLY_PRICE_CATEGORY_LABEL_BY_ID[currentCategory] || currentCategory);
  const quickQuoteDateRange = useMemo(() => {
    const months = quickQuoteDateFilter === "3m" ? 3 : quickQuoteDateFilter === "6m" ? 6 : 0;
    return months ? getRecentSupplyQuoteRange(months) : null;
  }, [quickQuoteDateFilter]);
  const monthRangeActive = Boolean(quickQuoteDateRange || fromMonth || toMonth);
  const monthFilteredItems = useMemo(() => {
    if (!monthRangeActive) return categoryFilteredItems;
    return categoryFilteredItems.filter((item) => {
      if (editingIds.has(String(item.id)) || isSupplyPriceItemEmpty(item)) return true;
      if (quickQuoteDateRange) {
        const quoteDate = String(item.quoteDate || "").slice(0, 10);
        return Boolean(quoteDate && quoteDate >= quickQuoteDateRange.from && quoteDate <= quickQuoteDateRange.to);
      }
      const quoteMonth = getSupplyQuoteMonth(item.quoteDate);
      if (!quoteMonth) return false;
      if (fromMonth && quoteMonth < fromMonth) return false;
      if (toMonth && quoteMonth > toMonth) return false;
      return true;
    });
  }, [categoryFilteredItems, editingIds, fromMonth, monthRangeActive, quickQuoteDateRange, toMonth]);
  const query = useMemo(() => search.trim().toLowerCase(), [search]);
  const filteredItems = useMemo(() => {
    const searchedItems = !query ? monthFilteredItems : monthFilteredItems.filter((item) => (
      editingIds.has(String(item.id)) || isSupplyPriceItemEmpty(item) || (item.ingredients || []).some((ingredient) => (
        ingredient.name.toLowerCase().includes(query)
      ))
    ));
    return [...searchedItems].sort((left, right) => {
      const leftEditing = editingIds.has(String(left.id));
      const rightEditing = editingIds.has(String(right.id));
      if (leftEditing !== rightEditing) return leftEditing ? -1 : 1;
      const leftEmpty = isSupplyPriceItemEmpty(left);
      const rightEmpty = isSupplyPriceItemEmpty(right);
      if (leftEmpty !== rightEmpty) return leftEmpty ? -1 : 1;
      const leftQuoteDate = String(left.quoteDate || "").slice(0, 10);
      const rightQuoteDate = String(right.quoteDate || "").slice(0, 10);
      if (leftQuoteDate !== rightQuoteDate) {
        if (!leftQuoteDate) return 1;
        if (!rightQuoteDate) return -1;
        return rightQuoteDate.localeCompare(leftQuoteDate);
      }
      return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
    });
  }, [editingIds, monthFilteredItems, query]);

  useEffect(() => {
    if (!focusedItemId) return;
    setSearch("");
    setQuickQuoteDateFilter("all");
    setFromMonth("");
    setToMonth("");
  }, [focusedItemId]);

  useEffect(() => {
    if (!focusedItemId) {
      focusedScrollHandledRef.current = null;
      return;
    }
    if (typeof document === "undefined") return;
    const focusKey = String(focusedItemId);
    if (focusedScrollHandledRef.current === focusKey) return;
    const target = document.getElementById(`supply-price-item-${focusKey}`);
    if (!target) return;
    focusedScrollHandledRef.current = focusKey;
    target.scrollIntoView({ behavior: "auto", block: "center" });
  }, [filteredItems, focusedItemId]);

  useEffect(() => {
    const copiedItemId = pendingCopiedItemScrollRef.current;
    if (!copiedItemId || typeof document === "undefined") return;
    const target = document.getElementById(`supply-price-item-${copiedItemId}`);
    if (!target) return;
    pendingCopiedItemScrollRef.current = null;
    target.scrollIntoView({ behavior: "auto", block: "start" });
  }, [filteredItems]);

  const applyQuickQuoteDateFilter = (filter) => {
    setQuickQuoteDateFilter(filter);
    if (filter === "all") {
      setFromMonth("");
      setToMonth("");
      return;
    }
    const range = getRecentSupplyQuoteRange(filter === "3m" ? 3 : 6);
    setFromMonth(range.from.slice(0, 7));
    setToMonth(range.to.slice(0, 7));
  };

  const exportSupplyPriceCsv = (exportItems, fileLabel) => {
    if (exportItems.length === 0) {
      window.alert("다운로드할 공급단가 항목이 없습니다.");
      return;
    }
    const headers = [
      "카테고리", "제조사", "허가사", "공급 성분", "함량/규격", "원료 원산지", "브랜드/공급처", "kg당 가격대",
      "포장단위", "포장형태", "수량", "최소 주문 배치 수량", "배치 당 공급단가", "VAT 포함", "배치 당 VAT 포함 가격",
      "총 금액", "VAT 포함 총금액", "허가사 수수료", "허가사 수수료율(%) / 상태", "수수료 포함 총금액",
      "견적일자", "사용기한", "첨부파일", "비고", "견적 채택 예상"
    ];
    const rows = exportItems.flatMap((item) => {
      const ingredients = item.ingredients?.length ? item.ingredients : [normalizeSupplyIngredient()];
      const totalPrice = formatTotalPrice(item.supplyUnitPrice, item.quantity);
      const vatUnitPrice = item.vatIncluded ? formatVatIncludedPrice(item.supplyUnitPrice) : "";
      const vatTotalPrice = item.vatIncluded ? formatTotalPrice(item.supplyUnitPrice, item.quantity, 1.1) : "";
      const supportsPermitCompanyFee = isPermitCompanyFeeCategory(item.category);
      const permitFeeRateUnknown = supportsPermitCompanyFee && item.permitCompanyFee && item.permitCompanyFeeRateUnknown;
      const permitFeeTotal = supportsPermitCompanyFee && item.permitCompanyFee
        ? (permitFeeRateUnknown
            ? formatTotalPrice(item.supplyUnitPrice, item.quantity, 1.1)
            : formatPermitFeeIncludedTotalPrice(item.supplyUnitPrice, item.quantity, item.permitCompanyFeeRate))
        : "";
      return ingredients.map((ingredient) => [
        SUPPLY_PRICE_CATEGORY_LABEL_BY_ID[item.category] || item.category,
        item.manufacturer,
        item.permitCompany,
        ingredient.name,
        ingredient.content,
        ingredient.origin,
        ingredient.brand,
        ingredient.kilogramPriceRange,
        item.packagingUnit,
        item.packagingForm,
        item.quantity,
        item.minimumOrderBatchQuantity,
        item.supplyUnitPrice,
        item.vatIncluded ? "포함" : "",
        vatUnitPrice,
        totalPrice,
        vatTotalPrice,
        supportsPermitCompanyFee && item.permitCompanyFee ? "해당" : "",
        supportsPermitCompanyFee ? (permitFeeRateUnknown ? "알 수 없음 (공급단가에 포함)" : item.permitCompanyFeeRate) : "",
        permitFeeTotal,
        item.quoteDate,
        item.shelfLife,
        item.attachment?.name || "",
        item.memo,
        item.quoteAdoptionExpected ? "채택 예상" : "채택 재고"
      ]);
    });
    const escapeCsvValue = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csvText = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
    const downloadUrl = URL.createObjectURL(new Blob([`\uFEFF${csvText}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `공급단가_${fileLabel}_${TODAY}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  };

  const requestCsvExport = () => {
    if (currentCategory !== "all") {
      exportSupplyPriceCsv(filteredItems, currentCategoryLabel);
      return;
    }
    setExportCategoryIds(SUPPLY_PRICE_CATEGORIES.map((category) => category.id));
    setIsCsvExportDialogOpen(true);
  };

  const toggleExportCategory = (categoryId) => {
    setExportCategoryIds((previous) => (
      previous.includes(categoryId)
        ? previous.filter((id) => id !== categoryId)
        : [...previous, categoryId]
    ));
  };

  const confirmCsvExport = () => {
    if (exportCategoryIds.length === 0) {
      window.alert("내려받을 카테고리를 하나 이상 선택해주세요.");
      return;
    }
    exportSupplyPriceCsv(
      safeItems.filter((item) => exportCategoryIds.includes(item.category)),
      exportCategoryIds.length === SUPPLY_PRICE_CATEGORIES.length ? "전체" : "선택카테고리"
    );
    setIsCsvExportDialogOpen(false);
  };

  const replaceItems = (nextItems) => {
    onItemsChange(normalizeSupplyPriceItems(nextItems));
  };

  const updateItem = (itemId, patch) => {
    replaceItems(safeItems.map((item) => (
      String(item.id) === String(itemId)
        ? { ...item, ...patch, updatedAt: new Date().toISOString() }
        : item
    )));
  };

  const cloneSupplyItem = (item) => normalizeSupplyPriceItem({
    ...item,
    ingredients: (item.ingredients || []).map((ingredient) => ({ ...ingredient })),
    attachment: item.attachment ? { ...item.attachment } : null,
    distributionStructure: {
      ...item.distributionStructure,
      pricingScenarios: (item.distributionStructure?.pricingScenarios || []).map((scenario) => ({ ...scenario })),
      competitors: (item.distributionStructure?.competitors || []).map((competitor) => ({
        ...competitor,
        priceTiers: (competitor.priceTiers || []).map((tier) => ({ ...tier }))
      }))
    },
    marketSizeAnalysis: {
      ...item.marketSizeAnalysis,
      marketYears: (item.marketSizeAnalysis?.marketYears || []).map((year) => ({ ...year }))
    }
  });

  const clearEditSnapshot = (itemId) => {
    const key = String(itemId);
    setEditSnapshots((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const addItem = () => {
    const nextItem = normalizeSupplyPriceItem({
      ...createSupplyPriceItem(),
      category: currentCategory === "all" ? DEFAULT_SUPPLY_PRICE_CATEGORY : currentCategory
    });
    replaceItems([nextItem, ...safeItems]);
    setEditingIds((prev) => new Set([...prev, String(nextItem.id)]));
    setEditSnapshots((prev) => ({ ...prev, [String(nextItem.id)]: null }));
  };

  const duplicateItem = (item) => {
    const now = new Date().toISOString();
    const nextItem = normalizeSupplyPriceItem({
      ...cloneSupplyItem(item),
      id: `supply_price_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      distributionStructure: {},
      marketSizeAnalysis: {},
      createdAt: now,
      updatedAt: ""
    });
    pendingCopiedItemScrollRef.current = String(nextItem.id);
    replaceItems([nextItem, ...safeItems]);
    setEditingIds((prev) => new Set([...prev, String(nextItem.id)]));
    setEditSnapshots((prev) => ({ ...prev, [String(nextItem.id)]: null }));
  };

  const deleteItem = (itemId) => {
    replaceItems(safeItems.filter((item) => String(item.id) !== String(itemId)));
    setEditingIds((prev) => {
      const next = new Set(prev);
      next.delete(String(itemId));
      return next;
    });
    clearEditSnapshot(itemId);
  };

  const requestDelete = (itemId) => {
    if (!isAdmin) {
      window.alert("공급단가 항목은 ADMIN만 삭제할 수 있습니다.");
      return;
    }
    setDeleteTargetId(itemId);
    setDeleteConfirmText("");
  };

  const closeDeleteConfirm = () => {
    setDeleteTargetId(null);
    setDeleteConfirmText("");
  };

  const confirmDelete = () => {
    if (!isAdmin) {
      closeDeleteConfirm();
      window.alert("공급단가 항목은 ADMIN만 삭제할 수 있습니다.");
      return;
    }
    if (deleteConfirmText.trim() !== "삭제합니다") {
      window.alert("'삭제합니다'를 정확히 입력해야 삭제할 수 있습니다.");
      return;
    }
    deleteItem(deleteTargetId);
    closeDeleteConfirm();
  };

  const setEditing = (itemId, editing) => {
    setEditingIds((prev) => {
      const next = new Set(prev);
      if (editing) next.add(String(itemId));
      else next.delete(String(itemId));
      return next;
    });
  };

  const startEditing = (item) => {
    setEditSnapshots((prev) => ({
      ...prev,
      [String(item.id)]: cloneSupplyItem(item)
    }));
    setEditing(item.id, true);
  };

  const cancelEditing = (itemId) => {
    const key = String(itemId);
    if (!Object.prototype.hasOwnProperty.call(editSnapshots, key)) {
      setEditing(itemId, false);
      return;
    }
    const snapshot = editSnapshots[key];
    if (snapshot === null) {
      deleteItem(itemId);
      return;
    }
    replaceItems(safeItems.map((item) => (
      String(item.id) === key ? cloneSupplyItem(snapshot) : item
    )));
    setEditing(itemId, false);
    clearEditSnapshot(itemId);
  };

  const saveItem = (itemId) => {
    const item = safeItems.find((candidate) => String(candidate.id) === String(itemId));
    if (!item) return;
    if (isRawMaterialSupplyCategory(item.category)) {
      const missingKilogramPrice = (item.ingredients || []).some((ingredient) => (
        ingredient.name.trim() && !ingredient.kilogramPriceRange.trim()
      ));
      if (missingKilogramPrice) {
        window.alert("건강기능식품 및 일반식품은 등록한 원료마다 kg당 가격대를 입력해주세요.");
        return;
      }
    }
    if (isPermitCompanyFeeCategory(item.category) && item.permitCompanyFee && !item.permitCompanyFeeRateUnknown) {
      const permitFeeRate = parseSupplyPriceNumber(item.permitCompanyFeeRate);
      if (permitFeeRate === null || permitFeeRate < 0) {
        window.alert("허가사 수수료율(%)을 숫자로 입력하거나 '알 수 없음'을 체크해주세요.");
        return;
      }
    }
    updateItem(itemId, {});
    setEditing(itemId, false);
    clearEditSnapshot(itemId);
  };

  const updateIngredient = (itemId, index, patch) => {
    const item = safeItems.find((candidate) => String(candidate.id) === String(itemId));
    if (!item) return;
    const ingredients = [...(item.ingredients || [normalizeSupplyIngredient()])];
    ingredients[index] = normalizeSupplyIngredient({ ...ingredients[index], ...patch });
    updateItem(itemId, { ingredients });
  };

  const addIngredient = (itemId) => {
    const item = safeItems.find((candidate) => String(candidate.id) === String(itemId));
    if (!item) return;
    updateItem(itemId, {
      ingredients: [...(item.ingredients || []), normalizeSupplyIngredient()]
    });
  };

  const removeIngredient = (itemId, index) => {
    const item = safeItems.find((candidate) => String(candidate.id) === String(itemId));
    if (!item) return;
    const ingredients = (item.ingredients || []).filter((_, currentIndex) => currentIndex !== index);
    updateItem(itemId, {
      ingredients: ingredients.length ? ingredients : [normalizeSupplyIngredient()]
    });
  };

  const handleAttachmentChange = async (itemId, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        window.alert("첨부파일은 10MB 이하만 업로드할 수 있습니다.");
        return;
      }
      if (!isSafeAttachmentFile(file)) {
        window.alert("PDF, 이미지, Word, Excel, CSV, TXT 파일만 첨부할 수 있습니다.");
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      updateItem(itemId, {
        attachment: {
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataUrl,
          uploadedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      window.alert(`파일 업로드 실패: ${errorMessage(error, "파일을 읽지 못했습니다.")}`);
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ ...supplyPanelStyle, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 23, fontWeight: 900 }}>공급단가</div>
            <div style={{ fontSize: 15, color: "#64748b", marginTop: 2 }}>
              {currentCategoryLabel} 공급단가를 건별로 추가하고 성분명으로 검색합니다.
            </div>
          </div>
          <div style={{ display: "grid", justifyItems: "end", gap: 7 }}>
            <SyncBadge syncState={syncState} />
            <button onClick={requestCsvExport} style={{ ...supplySubtleButtonStyle, fontSize: 14 }}>
              CSV 다운로드
            </button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 360px) minmax(360px, 460px) auto 1fr", gap: 8, alignItems: "end" }}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="성분명 검색"
            style={{ ...inputStyle, fontSize: 15 }}
          />
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
              {[
                ["3m", "최근 3개월"],
                ["6m", "최근 6개월"],
                ["all", "전체 견적"]
              ].map(([filter, label]) => {
                const active = quickQuoteDateFilter === filter;
                return (
                  <button
                    key={filter}
                    onClick={() => applyQuickQuoteDateFilter(filter)}
                    style={{ ...supplySubtleButtonStyle, padding: "7px 8px", borderColor: active ? "#2563eb" : "#cbd5e1", background: active ? "#eff6ff" : "#fff", color: active ? "#1d4ed8" : "#475569", fontWeight: 800 }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, alignItems: "center" }}>
              <input
                type="month"
                value={fromMonth}
                max={toMonth || undefined}
                onChange={(event) => {
                  setFromMonth(event.target.value);
                  setQuickQuoteDateFilter("custom");
                }}
                title="시작월"
                style={{ ...inputStyle, fontSize: 15 }}
              />
              <input
                type="month"
                value={toMonth}
                min={fromMonth || undefined}
                onChange={(event) => {
                  setToMonth(event.target.value);
                  setQuickQuoteDateFilter("custom");
                }}
                title="종료월"
                style={{ ...inputStyle, fontSize: 15 }}
              />
            </div>
          </div>
          <button onClick={addItem} style={supplyPrimaryButtonStyle}>+ 공급단가 건 추가</button>
          <div style={{ fontSize: 15, color: "#64748b", textAlign: "right" }}>
            전체 {safeItems.length}건 · 현재 {categoryFilteredItems.length}건{monthRangeActive ? ` · 기간 ${monthFilteredItems.length}건` : ""} · 표시 {filteredItems.length}건
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {filteredItems.map((item) => {
          const isEditing = editingIds.has(String(item.id));
          const ingredients = item.ingredients || [normalizeSupplyIngredient()];
          const isRawMaterialCategory = isRawMaterialSupplyCategory(item.category);
          const supportsPermitCompanyFee = isPermitCompanyFeeCategory(item.category);
          const totalPrice = formatTotalPrice(item.supplyUnitPrice, item.quantity);
          const vatIncludedPrice = item.vatIncluded ? formatVatIncludedPrice(item.supplyUnitPrice) : "";
          const vatTotalPrice = item.vatIncluded ? formatTotalPrice(item.supplyUnitPrice, item.quantity, 1.1) : "";
          const permitFeeRateUnknown = supportsPermitCompanyFee && item.permitCompanyFee && item.permitCompanyFeeRateUnknown;
          const permitFeeIncludedTotalPrice = supportsPermitCompanyFee && item.permitCompanyFee
            ? (permitFeeRateUnknown
                ? formatTotalPrice(item.supplyUnitPrice, item.quantity, 1.1)
                : formatPermitFeeIncludedTotalPrice(item.supplyUnitPrice, item.quantity, item.permitCompanyFeeRate))
            : "";
          return (
            <div
              key={item.id}
              id={`supply-price-item-${item.id}`}
              style={{
                ...supplyCardStyle,
                boxShadow: String(item.id) === String(focusedItemId)
                  ? "0 0 0 3px rgba(37, 99, 235, .32), 0 12px 28px rgba(15, 23, 42, .12)"
                  : supplyCardStyle.boxShadow
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 1520, borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: 110 }} />
                    <col style={{ width: 150 }} />
                    <col style={{ width: 480 }} />
                    <col style={{ width: 210 }} />
                    <col style={{ width: 90 }} />
                    <col style={{ width: 230 }} />
                    <col style={{ width: 155 }} />
                  </colgroup>
                  <thead>
                    <tr style={supplyHeaderRowStyle}>
                      {["카테고리", "제조사", "세부 공급내역", isRawMaterialCategory ? "배치 당 전체 견적단가" : "배치 당 공급단가", "VAT 포함", "배치 당 VAT 포함 가격", "관리"].map((header) => (
                        <th key={header} style={{ textAlign: "left", padding: "9px 10px", fontSize: 14, color: "#1e3a8a", borderBottom: "1px solid #bfdbfe", whiteSpace: "nowrap" }}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ ...supplyBodyRowStyle, verticalAlign: "top" }}>
                      <td style={{ padding: 8 }}>
                        {isEditing ? (
                          <select
                            value={item.category}
                            onChange={(event) => {
                              const category = event.target.value;
                              updateItem(item.id, {
                                category,
                                permitCompanyFee: isPermitCompanyFeeCategory(category) ? item.permitCompanyFee : false,
                                permitCompanyFeeRate: isPermitCompanyFeeCategory(category) ? item.permitCompanyFeeRate : "",
                                permitCompanyFeeRateUnknown: isPermitCompanyFeeCategory(category) ? item.permitCompanyFeeRateUnknown : false,
                                permitCompany: isPermitCompanyFeeCategory(category) ? item.permitCompany : ""
                              });
                            }}
                            style={supplyCompactInputStyle}
                          >
                            {SUPPLY_PRICE_CATEGORIES.map((category) => (
                              <option key={category.id} value={category.id}>{category.label}</option>
                            ))}
                          </select>
                        ) : (
                          <div style={supplyTextCellStyle}>{SUPPLY_PRICE_CATEGORY_LABEL_BY_ID[item.category] || item.category || "-"}</div>
                        )}
                      </td>
                      <td style={{ padding: 8 }}>
                        {isEditing ? (
                          <div style={{ display: "grid", gap: 8 }}>
                            <div>
                              <label style={supplyFieldLabelStyle}>제조사</label>
                              <input
                                value={item.manufacturer}
                                onChange={(event) => updateItem(item.id, { manufacturer: event.target.value })}
                                placeholder="제조사"
                                style={supplyCompactInputStyle}
                              />
                            </div>
                            <div>
                              <label style={supplyFieldLabelStyle}>허가사</label>
                              <input
                                value={item.permitCompany}
                                disabled={!item.permitCompanyFee}
                                onChange={(event) => updateItem(item.id, { permitCompany: event.target.value })}
                                placeholder={item.permitCompanyFee ? "허가사" : "허가사 수수료 해당 체크 후 입력"}
                                style={{
                                  ...supplyCompactInputStyle,
                                  background: item.permitCompanyFee ? "#fff" : "#f1f5f9",
                                  color: item.permitCompanyFee ? "#0f172a" : "#94a3b8",
                                  cursor: item.permitCompanyFee ? "text" : "not-allowed"
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "grid", gap: 5 }}>
                            <div style={supplyTextCellStyle}>{item.manufacturer || "-"}</div>
                            {item.permitCompanyFee && (
                              <div style={{ ...supplyTextCellStyle, color: "#64748b", fontSize: 12 }}>
                                허가사: {item.permitCompany || "미입력"}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: 8 }}>
                        {isEditing ? (
                          <div style={{ display: "grid", gap: 6 }}>
                            {ingredients.map((ingredient, index) => (
                              <div key={`${item.id}_ingredient_${index}`} style={{ display: "grid", gridTemplateColumns: isRawMaterialCategory ? "1fr 1fr 1fr 1fr 1fr auto" : "1fr 1fr auto", gap: 6, alignItems: "end" }}>
                                <div>
                                  <label style={supplyFieldLabelStyle}>공급 성분</label>
                                  <input value={ingredient.name} onChange={(event) => updateIngredient(item.id, index, { name: event.target.value })} placeholder="성분명" style={supplyCompactInputStyle} />
                                </div>
                                <div>
                                  <label style={supplyFieldLabelStyle}>{isRawMaterialCategory ? "규격 / 함량" : "함량"}</label>
                                  <input value={ingredient.content} onChange={(event) => updateIngredient(item.id, index, { content: event.target.value })} placeholder={isRawMaterialCategory ? "예: 분말, 98%" : "예: 500mg/정"} style={supplyCompactInputStyle} />
                                </div>
                                {isRawMaterialCategory && <div>
                                  <label style={supplyFieldLabelStyle}>원료 원산지</label>
                                  <input value={ingredient.origin} onChange={(event) => updateIngredient(item.id, index, { origin: event.target.value })} placeholder="예: 인도" style={supplyCompactInputStyle} />
                                </div>}
                                {isRawMaterialCategory && <div>
                                  <label style={supplyFieldLabelStyle}>브랜드 / 공급처</label>
                                  <input value={ingredient.brand} onChange={(event) => updateIngredient(item.id, index, { brand: event.target.value })} placeholder="브랜드 또는 공급처" style={supplyCompactInputStyle} />
                                </div>}
                                {isRawMaterialCategory && <div>
                                  <label style={supplyFieldLabelStyle}>kg당 가격대 *</label>
                                  <input value={ingredient.kilogramPriceRange} onChange={(event) => updateIngredient(item.id, index, { kilogramPriceRange: event.target.value })} placeholder="예: 12,000 ~ 15,000원" style={supplyCompactInputStyle} />
                                </div>}
                                <button onClick={() => removeIngredient(item.id, index)} style={{ ...supplySubtleButtonStyle, padding: "5px 7px", fontSize: 14 }}>삭제</button>
                              </div>
                            ))}
                            <button onClick={() => addIngredient(item.id)} style={{ ...supplySubtleButtonStyle, width: 128 }}>
                              + 성분 추가
                            </button>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, paddingTop: 4, borderTop: "1px dashed #e2e8f0" }}>
                              <div>
                                <label style={supplyFieldLabelStyle}>포장단위</label>
                                <input
                                  value={item.packagingUnit}
                                  onChange={(event) => updateItem(item.id, { packagingUnit: event.target.value })}
                                  placeholder="포장단위"
                                  style={supplyCompactInputStyle}
                                />
                              </div>
                              <div>
                                <label style={supplyFieldLabelStyle}>포장형태</label>
                                <input
                                  value={item.packagingForm}
                                  onChange={(event) => updateItem(item.id, { packagingForm: event.target.value })}
                                  placeholder="포장형태"
                                  style={supplyCompactInputStyle}
                                />
                              </div>
                              <div>
                                <label style={supplyFieldLabelStyle}>수량</label>
                                <input
                                  value={item.quantity}
                                  onChange={(event) => updateItem(item.id, { quantity: event.target.value })}
                                  placeholder="수량"
                                  style={supplyCompactInputStyle}
                                />
                              </div>
                            </div>
                            <div>
                              <label style={supplyFieldLabelStyle}>최소 주문 배치 수량</label>
                              <input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={item.minimumOrderBatchQuantity}
                                onChange={(event) => updateItem(item.id, { minimumOrderBatchQuantity: event.target.value })}
                                placeholder="최소 주문 배치 수량"
                                style={supplyCompactInputStyle}
                              />
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "grid", gap: 4 }}>
                            {ingredients.some((ingredient) => ingredient.name || ingredient.content || ingredient.origin || ingredient.brand || ingredient.kilogramPriceRange) ? ingredients.map((ingredient, index) => (
                              <div key={`${item.id}_ingredient_view_${index}`} style={supplyTextCellStyle}>
                                {ingredient.name || "-"}{ingredient.content ? ` / ${ingredient.content}` : ""}
                                {isRawMaterialCategory && ingredient.origin ? ` · 원산지: ${ingredient.origin}` : ""}
                                {isRawMaterialCategory && ingredient.brand ? ` · 브랜드/공급처: ${ingredient.brand}` : ""}
                                {isRawMaterialCategory && ingredient.kilogramPriceRange ? ` · kg당: ${ingredient.kilogramPriceRange}` : ""}
                              </div>
                            )) : <div style={supplyTextCellStyle}>-</div>}
                            {(item.packagingUnit || item.packagingForm || item.quantity || item.minimumOrderBatchQuantity) && (
                              <div style={{ ...supplyTextCellStyle, color: "#64748b", paddingTop: 4, borderTop: "1px dashed #e2e8f0" }}>
                                {item.packagingUnit ? `포장단위: ${item.packagingUnit}` : ""}
                                {item.packagingUnit && (item.packagingForm || item.quantity || item.minimumOrderBatchQuantity) ? " · " : ""}
                                {item.packagingForm ? `포장형태: ${item.packagingForm}` : ""}
                                {item.packagingForm && (item.quantity || item.minimumOrderBatchQuantity) ? " · " : ""}
                                {item.quantity ? `수량: ${item.quantity}` : ""}
                                {item.quantity && item.minimumOrderBatchQuantity ? " · " : ""}
                                {item.minimumOrderBatchQuantity ? `최소 주문 배치 수량: ${item.minimumOrderBatchQuantity}` : ""}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: 8 }}>
                        {isEditing ? (
                          <div style={{ display: "grid", gap: 6 }}>
                            <div>
                              <label style={supplyFieldLabelStyle}>{isRawMaterialCategory ? "배치 당 전체 견적단가" : "배치 당 공급단가"}</label>
                              <input value={item.supplyUnitPrice} onChange={(event) => updateItem(item.id, { supplyUnitPrice: event.target.value })} placeholder={isRawMaterialCategory ? "예: 배치 당 전체 견적단가" : "예: 배치 당 1,250원"} style={supplyCompactInputStyle} />
                            </div>
                            <div>
                              <label style={supplyFieldLabelStyle}>총 견적금액</label>
                              <input
                                value={totalPrice}
                                readOnly
                                placeholder="수량 입력 시 자동계산"
                                style={{ ...supplyCompactInputStyle, background: "#f8fafc", color: totalPrice ? "#0f172a" : "#94a3b8", fontWeight: 800 }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={supplyTextCellStyle}>{item.supplyUnitPrice || "-"}</div>
                            {totalPrice && (
                              <div style={supplyMoneyTextStyle}>
                                {isRawMaterialCategory ? "총 견적금액" : "총 금액"}: {totalPrice}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: 8 }}>
                        {isEditing ? (
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, color: "#334155", fontWeight: 700 }}>
                            <input
                              type="checkbox"
                              checked={Boolean(item.vatIncluded)}
                              onChange={(event) => updateItem(item.id, { vatIncluded: event.target.checked })}
                            />
                            포함
                          </label>
                        ) : (
                          <div style={supplyTextCellStyle}>{item.vatIncluded ? "포함" : "-"}</div>
                        )}
                      </td>
                      <td style={{ padding: 8 }}>
                        {isEditing ? (
                          <div style={{ display: "grid", gap: 6 }}>
                            <input
                              value={vatIncludedPrice}
                              readOnly
                              placeholder="자동계산"
                              style={{ ...supplyCompactInputStyle, background: "#f8fafc", color: item.vatIncluded ? "#0f172a" : "#94a3b8", fontWeight: 800 }}
                            />
                            <input
                              value={vatTotalPrice}
                              readOnly
                              placeholder="총 견적금액"
                              style={{ ...supplyCompactInputStyle, background: "#f8fafc", color: vatTotalPrice ? "#0f172a" : "#94a3b8", fontWeight: 800 }}
                            />
                            {supportsPermitCompanyFee && <>
                              <div>
                                <label style={supplyFieldLabelStyle}>허가사 수수료율 (%)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  inputMode="decimal"
                                  value={item.permitCompanyFeeRate}
                                  disabled={!item.permitCompanyFee || item.permitCompanyFeeRateUnknown}
                                  onChange={(event) => updateItem(item.id, { permitCompanyFeeRate: event.target.value })}
                                  placeholder={item.permitCompanyFeeRateUnknown ? "공급단가에 수수료 포함" : (item.permitCompanyFee ? "예: 10" : "허가사 수수료 체크 후 입력")}
                                  style={{
                                    ...supplyCompactInputStyle,
                                    background: item.permitCompanyFee && !item.permitCompanyFeeRateUnknown ? "#fff" : "#f1f5f9",
                                    color: item.permitCompanyFee && !item.permitCompanyFeeRateUnknown ? "#0f172a" : "#94a3b8",
                                    cursor: item.permitCompanyFee && !item.permitCompanyFeeRateUnknown ? "text" : "not-allowed"
                                  }}
                                />
                                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, color: item.permitCompanyFee ? "#334155" : "#94a3b8", fontSize: 13, fontWeight: 800 }}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(item.permitCompanyFeeRateUnknown)}
                                    disabled={!item.permitCompanyFee}
                                    onChange={(event) => updateItem(item.id, {
                                      permitCompanyFeeRateUnknown: event.target.checked,
                                      permitCompanyFeeRate: event.target.checked ? "" : item.permitCompanyFeeRate
                                    })}
                                  />
                                  알 수 없음
                                </label>
                                {item.permitCompanyFeeRateUnknown && (
                                  <div style={{ marginTop: 4, color: "#64748b", fontSize: 11, lineHeight: 1.4 }}>
                                    배치 당 공급단가에 허가사 수수료가 이미 포함된 것으로 계산합니다.
                                  </div>
                                )}
                              </div>
                              <div>
                                <label style={supplyFieldLabelStyle}>수수료 포함 총금액</label>
                                <input
                                  value={permitFeeIncludedTotalPrice}
                                  readOnly
                                  disabled={!item.permitCompanyFee}
                                  placeholder={item.permitCompanyFeeRateUnknown ? "공급단가 기준 자동계산" : (item.permitCompanyFee ? "수수료율 입력 시 자동계산" : "허가사 수수료 체크 후 자동계산")}
                                  style={{ ...supplyCompactInputStyle, background: item.permitCompanyFee ? "#f8fafc" : "#f1f5f9", color: permitFeeIncludedTotalPrice ? "#0f172a" : "#94a3b8", fontWeight: 800 }}
                                />
                              </div>
                            </>}
                          </div>
                        ) : item.vatIncluded ? (
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={supplyMoneyTextStyle}>
                              {vatIncludedPrice || "-"}
                            </div>
                            {vatTotalPrice && (
                              <div style={supplyMoneyTextStyle}>
                                {isRawMaterialCategory ? "총 견적금액" : "총 금액"}: {vatTotalPrice}
                              </div>
                            )}
                            {supportsPermitCompanyFee && item.permitCompanyFee && item.permitCompanyFeeRate && (
                              <div style={supplyTextCellStyle}>허가사 수수료율: {item.permitCompanyFeeRate}%</div>
                            )}
                            {supportsPermitCompanyFee && item.permitCompanyFee && item.permitCompanyFeeRateUnknown && (
                              <div style={supplyTextCellStyle}>허가사 수수료율: 알 수 없음 · 공급단가에 포함</div>
                            )}
                            {supportsPermitCompanyFee && permitFeeIncludedTotalPrice && (
                              <div style={supplyMoneyTextStyle}>수수료 포함 총금액: {permitFeeIncludedTotalPrice}</div>
                            )}
                          </div>
                        ) : (
                          <div style={supplyTextCellStyle}>-</div>
                        )}
                      </td>
                      <td style={{ padding: 8 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {isEditing ? (
                            <>
                              <button onClick={() => saveItem(item.id)} style={{ ...supplyPrimaryButtonStyle, padding: "6px 9px", fontSize: 15 }}>
                                저장
                              </button>
                              <button onClick={() => cancelEditing(item.id)} style={supplySubtleButtonStyle}>
                                취소
                              </button>
                              {isAdmin && (
                                <button onClick={() => requestDelete(item.id)} style={{ ...supplySubtleButtonStyle, borderColor: "#fecaca", color: "#dc2626" }}>
                                  삭제
                                </button>
                              )}
                            </>
                           ) : (
                             <>
                               <button
                                 onClick={() => duplicateItem(item)}
                                 title="입력값을 복사해 새로운 공급단가 건을 만듭니다."
                                 style={supplySubtleButtonStyle}
                               >
                                 복사
                               </button>
                               <button onClick={() => startEditing(item)} style={supplySubtleButtonStyle}>
                                 수정
                               </button>
                             </>
                           )}
                         </div>
                       </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ borderTop: "1px solid #cbd5e1", overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 1460, borderCollapse: "collapse" }}>
                  <tbody>
                    <tr style={{ ...supplyDetailHeaderRowStyle, height: 38 }}>
                      {[
                        ...(supportsPermitCompanyFee ? ["허가사 수수료"] : []),
                        "견적일자", "사용기한", "첨부파일", "비고", "견적 채택 예상"
                      ].map((header) => (
                        <th key={header} style={{ textAlign: "left", padding: "9px 10px", fontSize: 14, color: "#3730a3", borderBottom: "1px solid #c7d2fe", whiteSpace: "nowrap" }}>
                          {header}
                        </th>
                      ))}
                      <td rowSpan={2} style={{ padding: 6, width: 170, verticalAlign: "middle", background: "#fff", borderLeft: "1px solid #cbd5e1" }}>
                        <button
                          onClick={() => onOpenDistribution?.(item.id)}
                          style={{
                            ...supplySubtleButtonStyle,
                            width: "100%",
                            height: "100%",
                            minHeight: 64,
                            display: "grid",
                            placeItems: "center",
                            alignContent: "center",
                            gap: 2,
                            borderColor: "#93c5fd",
                            background: "#fff",
                            color: "#1d4ed8",
                            fontSize: 14,
                            lineHeight: 1.25,
                            fontWeight: 900
                          }}
                        >
                          <span>유통 구조</span>
                          <span>바로가기</span>
                        </button>
                      </td>
                    </tr>
                    <tr style={{ ...supplyDetailBodyRowStyle, height: 38, verticalAlign: "top" }}>
                      {supportsPermitCompanyFee && <td style={{ padding: 8, width: 118 }}>
                        {isEditing ? (
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, color: "#334155", fontWeight: 700 }}>
                            <input
                              type="checkbox"
                              checked={Boolean(item.permitCompanyFee)}
                              onChange={(event) => updateItem(item.id, {
                                permitCompanyFee: event.target.checked,
                                permitCompanyFeeRateUnknown: event.target.checked ? item.permitCompanyFeeRateUnknown : false,
                                permitCompany: event.target.checked ? item.permitCompany : ""
                              })}
                            />
                            해당
                          </label>
                        ) : (
                          <div style={supplyTextCellStyle}>{item.permitCompanyFee ? "해당" : "-"}</div>
                        )}
                      </td>}
                      <td style={{ padding: 8, width: 130 }}>
                        {isEditing ? (
                          <input type="date" value={item.quoteDate} onChange={(event) => updateItem(item.id, { quoteDate: event.target.value })} style={supplyCompactInputStyle} />
                        ) : (
                          <div style={{ ...supplyTextCellStyle, display: "flex", alignItems: "center", gap: 7 }}>
                            <span>{item.quoteDate ? fmt(item.quoteDate) : "-"}</span>
                            {isSupplyQuoteOlderThanMonths(item.quoteDate, 6) && (
                              <span
                                title="현재 기준으로 견적 수령일로부터 6개월이 초과하였으니 견적 내용을 재확인해주세요."
                                aria-label="6개월이 지난 견적 재확인 필요"
                                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, flex: "0 0 18px", borderRadius: "50%", background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626", fontSize: 12, fontWeight: 900, cursor: "help" }}
                              >
                                !
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: 8, width: 180 }}>
                        {isEditing ? (
                          <input
                            value={item.shelfLife}
                            onChange={(event) => updateItem(item.id, { shelfLife: event.target.value })}
                            placeholder="예: 제조일로부터 24개월"
                            style={supplyCompactInputStyle}
                          />
                        ) : (
                          <div style={supplyTextCellStyle}>{item.shelfLife || "-"}</div>
                        )}
                      </td>
                      <td style={{ padding: 8, width: 300 }}>
                        {isEditing && (
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp,application/pdf"
                            onChange={(event) => handleAttachmentChange(item.id, event)}
                            style={{ width: "100%", fontSize: 14, marginBottom: 5 }}
                          />
                        )}
                        {item.attachment ? (
                          <div style={{ display: "grid", gap: 4 }}>
                            <span style={{ fontSize: 14, color: "#475569", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.attachment.name} ({formatBytes(item.attachment.size)})
                            </span>
                            <div style={{ display: "flex", gap: 6 }}>
                              {item.attachment.dataUrl && (
                                <a href={item.attachment.dataUrl} download={item.attachment.name} style={{ fontSize: 14, color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>
                                  다운로드
                                </a>
                              )}
                              {isEditing && <button onClick={() => updateItem(item.id, { attachment: null })} style={{ ...supplySubtleButtonStyle, padding: "3px 6px", fontSize: 14 }}>삭제</button>}
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: 14, color: "#94a3b8" }}>첨부파일 없음</div>
                        )}
                      </td>
                      <td style={{ padding: 8, width: 300 }}>
                        {isEditing ? (
                          <textarea value={item.memo} onChange={(event) => updateItem(item.id, { memo: event.target.value })} placeholder="비고" style={supplyCompactTextareaStyle} />
                        ) : (
                          <div style={supplyTextCellStyle}>{item.memo || "-"}</div>
                        )}
                      </td>
                      <td style={{ padding: 8, width: 180 }}>
                        {isEditing ? (
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 14, color: item.quoteAdoptionExpected ? "#047857" : "#b45309", fontWeight: 800, cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={Boolean(item.quoteAdoptionExpected)}
                              onChange={(event) => updateItem(item.id, { quoteAdoptionExpected: event.target.checked })}
                            />
                            {item.quoteAdoptionExpected ? "채택 예상" : "채택 재고"}
                          </label>
                        ) : (
                          <span style={{
                            display: "inline-flex",
                            padding: "4px 8px",
                            borderRadius: 5,
                            border: `1px solid ${item.quoteAdoptionExpected ? "#a7f3d0" : "#fde68a"}`,
                            background: item.quoteAdoptionExpected ? "#ecfdf5" : "#fffbeb",
                            color: item.quoteAdoptionExpected ? "#047857" : "#b45309",
                            fontSize: 12,
                            fontWeight: 900,
                            whiteSpace: "nowrap"
                          }}>
                            {item.quoteAdoptionExpected ? "채택 예상" : "채택 재고"}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        {filteredItems.length === 0 && (
          <div style={{ ...supplyPanelStyle, padding: 24, fontSize: 15, color: "#94a3b8", textAlign: "center" }}>
            {safeItems.length === 0 ? "아직 등록된 공급단가가 없습니다." : "현재 카테고리에서 표시할 공급단가가 없습니다."}
          </div>
        )}
      </div>

      {isCsvExportDialogOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: 460, maxWidth: "94vw", background: "#fff", borderRadius: 10, border: "1px solid #bfdbfe", boxShadow: "0 20px 60px rgba(0,0,0,.22)", padding: 18 }}>
            <div style={{ fontSize: 19, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>공급단가 CSV 다운로드</div>
            <div style={{ fontSize: 15, color: "#475569", lineHeight: 1.5, marginBottom: 14 }}>
              내려받을 카테고리를 선택하세요. 전체 카테고리도 그대로 받을 수 있습니다.
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 6, fontSize: 15, fontWeight: 800, color: "#1e3a8a", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={exportCategoryIds.length === SUPPLY_PRICE_CATEGORIES.length}
                onChange={(event) => setExportCategoryIds(event.target.checked ? SUPPLY_PRICE_CATEGORIES.map((category) => category.id) : [])}
              />
              전체 카테고리
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              {SUPPLY_PRICE_CATEGORIES.map((category) => {
                const count = safeItems.filter((item) => item.category === category.id).length;
                return (
                  <label key={category.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 10px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 15, color: "#334155", cursor: "pointer" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <input type="checkbox" checked={exportCategoryIds.includes(category.id)} onChange={() => toggleExportCategory(category.id)} />
                      {category.label}
                    </span>
                    <span style={{ fontSize: 13, color: "#64748b" }}>{count}건</span>
                  </label>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button onClick={() => setIsCsvExportDialogOpen(false)} style={supplySubtleButtonStyle}>취소</button>
              <button onClick={confirmCsvExport} style={supplyPrimaryButtonStyle}>CSV 다운로드</button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && deleteTargetId !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: 420, maxWidth: "94vw", background: "#fff", borderRadius: 10, border: "1px solid #fecaca", boxShadow: "0 20px 60px rgba(0,0,0,.22)", padding: 18 }}>
            <div style={{ fontSize: 19, fontWeight: 900, color: "#991b1b", marginBottom: 8 }}>공급단가 항목 삭제</div>
            <div style={{ fontSize: 16, color: "#475569", lineHeight: 1.5, marginBottom: 12 }}>
              정말 삭제하시겠습니까? 아래 칸에 <b>삭제합니다</b> 를 입력하세요.
            </div>
            <input
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder="삭제합니다"
              style={{ ...inputStyle, fontSize: 15 }}
              autoFocus
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button onClick={closeDeleteConfirm} style={supplySubtleButtonStyle}>취소</button>
              <button
                onClick={confirmDelete}
                style={{ ...supplyPrimaryButtonStyle, background: deleteConfirmText.trim() === "삭제합니다" ? "#dc2626" : "#94a3b8" }}
              >
                삭제 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CommunicationTab({ project, onSaveLog }) {
  const emptyForm = {
    date: TODAY,
    company: "",
    contact: "",
    channel: "전화",
    summary: "",
    outcome: "",
    nextAction: ""
  };
  const [form, setForm] = useState({
    date: TODAY,
    company: "",
    contact: "",
    channel: "전화",
    summary: "",
    outcome: "",
    nextAction: ""
  });
  const [editingId, setEditingId] = useState(null);
  const logs = project.communicationLog || [];

  const save = () => {
    if (!form.company || !form.summary) {
      window.alert("업체명과 소통 내용을 입력해주세요.");
      return;
    }
    onSaveLog({
      ...form,
      id: editingId || Date.now(),
      updatedAt: editingId ? new Date().toISOString() : undefined
    });
    setEditingId(null);
    setForm(emptyForm);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      date: item.date || TODAY,
      company: item.company || "",
      contact: item.contact || "",
      channel: item.channel || "전화",
      summary: item.summary || "",
      outcome: item.outcome || "",
      nextAction: item.nextAction || ""
    });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14 }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>{editingId ? "업체 소통 기록 수정" : "업체 소통 기록"}</div>
        <div style={{ display: "grid", gap: 8 }}>
          <input placeholder="업체명*" value={form.company} onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))} style={inputStyle} />
          <input placeholder="담당자" value={form.contact} onChange={(e) => setForm((prev) => ({ ...prev, contact: e.target.value }))} style={inputStyle} />
          <input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} style={inputStyle} />
          <select value={form.channel} onChange={(e) => setForm((prev) => ({ ...prev, channel: e.target.value }))} style={inputStyle}>
            {["전화", "이메일", "미팅", "메신저", "방문", "기타"].map((value) => <option key={value}>{value}</option>)}
          </select>
          <textarea rows={3} placeholder="소통 내용*" value={form.summary} onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))} style={{ ...inputStyle, resize: "vertical" }} />
          <textarea rows={2} placeholder="판단/결과 (예: A업체 제외, B업체 진행)" value={form.outcome} onChange={(e) => setForm((prev) => ({ ...prev, outcome: e.target.value }))} style={{ ...inputStyle, resize: "vertical" }} />
          <input placeholder="후속 조치" value={form.nextAction} onChange={(e) => setForm((prev) => ({ ...prev, nextAction: e.target.value }))} style={inputStyle} />
          <button onClick={save} style={primaryButton}>{editingId ? "수정 저장" : "저장"}</button>
          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
              style={subtleButton}
            >
              수정 취소
            </button>
          )}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontWeight: 800 }}>소통 히스토리 ({logs.length}건)</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>CSV는 최상단 데이터 이전 탭에서 일괄 내보내기</div>
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
              <div style={{ marginTop: 8 }}>
                <button onClick={() => startEdit(item)} style={subtleButton}>수정</button>
              </div>
            </div>
          ))}
          {logs.length === 0 && <div style={{ color: "#94a3b8", textAlign: "center", padding: 24 }}>기록이 없습니다.</div>}
        </div>
      </div>
    </div>
  );
}

const DECISION_IMPACT_OPTIONS = ["낮음", "보통", "높음", "매우 높음"];
const DECISION_STATUS_OPTIONS = ["검토 요청", "결정 완료", "보류/재검토", "반려", "후속 확인 필요"];

function normalizeDecisionImpact(value) {
  if (value === "크리티컬") return "매우 높음";
  if (DECISION_IMPACT_OPTIONS.includes(value)) return value;
  return value || "보통";
}

function normalizeDecisionStatus(value) {
  if (value === "의사결정 완료") return "결정 완료";
  if (value === "검토중") return "검토 요청";
  if (value === "보류") return "보류/재검토";
  if (DECISION_STATUS_OPTIONS.includes(value)) return value;
  return value || "결정 완료";
}

function DecisionField({ label, helper, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: "#334155", fontWeight: 800, marginBottom: 4 }}>{label}</label>
      {children}
      {helper && <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{helper}</div>}
    </div>
  );
}

function DecisionTab({ project, onSaveLog }) {
  const emptyForm = {
    date: TODAY,
    decider: "대표",
    title: "",
    impact: "보통",
    status: "결정 완료",
    description: ""
  };
  const [form, setForm] = useState({
    date: TODAY,
    decider: "대표",
    title: "",
    impact: "보통",
    status: "결정 완료",
    description: ""
  });
  const [editingId, setEditingId] = useState(null);
  const logs = project.decisionLog || [];

  const save = () => {
    if (!form.title || !form.description) {
      window.alert("안건명과 의사결정 상세 내용을 입력해주세요.");
      return;
    }
    onSaveLog({
      ...form,
      id: editingId || Date.now(),
      updatedAt: editingId ? new Date().toISOString() : undefined
    });
    setEditingId(null);
    setForm(emptyForm);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      date: item.date || TODAY,
      decider: item.decider || "대표",
      title: item.title || "",
      impact: normalizeDecisionImpact(item.impact),
      status: normalizeDecisionStatus(item.status),
      description: item.description || ""
    });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14 }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>{editingId ? "대표/부대표 의사결정 수정" : "대표/부대표 의사결정 기록"}</div>
        <div style={{ display: "grid", gap: 10 }}>
          <DecisionField label="결정일" helper="대표/부대표가 검토하거나 결정을 남긴 날짜입니다.">
            <input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} style={inputStyle} />
          </DecisionField>
          <DecisionField label="결정권자" helper="최종 판단 주체를 선택합니다.">
            <select value={form.decider} onChange={(e) => setForm((prev) => ({ ...prev, decider: e.target.value }))} style={inputStyle}>
              {["대표", "부대표", "공동결정"].map((value) => <option key={value}>{value}</option>)}
            </select>
          </DecisionField>
          <DecisionField label="안건명 *" helper="결정해야 하는 주제를 한 줄로 적습니다.">
            <input placeholder="예: 이부프로펜 200/400 및 용량 결정" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} style={inputStyle} />
          </DecisionField>
          <DecisionField label="사업 영향도" helper="일정, 비용, 허가, 판매 전략에 미치는 영향 수준입니다.">
            <select value={form.impact} onChange={(e) => setForm((prev) => ({ ...prev, impact: e.target.value }))} style={inputStyle}>
              {DECISION_IMPACT_OPTIONS.map((value) => <option key={value}>{value}</option>)}
            </select>
          </DecisionField>
          <DecisionField label="처리상태" helper="이 안건의 현재 단계입니다. 아직 검토 중인지, 결정됐는지, 추가 확인이 필요한지 선택합니다.">
            <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} style={inputStyle}>
              {DECISION_STATUS_OPTIONS.map((value) => <option key={value}>{value}</option>)}
            </select>
          </DecisionField>
          <DecisionField label="결정 내용 및 요청사항 *" helper="결정된 내용, 판단 근거, 조건, 다음 조치가 있으면 함께 남깁니다.">
            <textarea rows={5} placeholder="예: 참여약사 핵심지부장 간담회 참석자에게 제품 관련 선언문 요청 진행" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} style={{ ...inputStyle, resize: "vertical" }} />
          </DecisionField>
          <button onClick={save} style={primaryButton}>{editingId ? "수정 저장" : "저장"}</button>
          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
              style={subtleButton}
            >
              수정 취소
            </button>
          )}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontWeight: 800 }}>의사결정 아카이브 ({logs.length}건)</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>CSV는 최상단 데이터 이전 탭에서 일괄 내보내기</div>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {[...logs].reverse().map((item) => (
            <div key={item.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", overflow: "hidden" }}>
              <div style={{ padding: "8px 10px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 800 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>결정일 {fmt(item.date)}</div>
              </div>
              <div style={{ padding: "8px 10px", display: "flex", gap: 6, flexWrap: "wrap", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: 11, color: "#334155", background: "#e0f2fe", borderRadius: 999, padding: "3px 8px", fontWeight: 700 }}>결정권자: {item.decider || "-"}</span>
                <span style={{ fontSize: 11, color: "#334155", background: "#fef3c7", borderRadius: 999, padding: "3px 8px", fontWeight: 700 }}>사업 영향도: {normalizeDecisionImpact(item.impact)}</span>
                <span style={{ fontSize: 11, color: "#334155", background: "#dcfce7", borderRadius: 999, padding: "3px 8px", fontWeight: 700 }}>처리상태: {normalizeDecisionStatus(item.status)}</span>
              </div>
              <div style={{ padding: 10, fontSize: 13, whiteSpace: "pre-wrap" }}>{item.description}</div>
              <div style={{ padding: "0 10px 10px" }}>
                <button onClick={() => startEdit(item)} style={subtleButton}>수정</button>
              </div>
            </div>
          ))}
          {logs.length === 0 && <div style={{ color: "#94a3b8", textAlign: "center", padding: 24 }}>기록이 없습니다.</div>}
        </div>
      </div>
    </div>
  );
}

function BackupTab({ projects, adminLogs, supplyPriceItems, marketAnalysisDefaults, onRestore, isAdmin }) {
  const fullBackupInputRef = useRef(null);
  const moduleBackupInputRefs = useRef({});
  const [transferState, setTransferState] = useState({ status: "idle", message: "" });
  const [pendingRestore, setPendingRestore] = useState(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState("");

  const downloadFullBackup = async () => {
    setTransferState({ status: "working", message: "서버 저장소에서 전체 데이터를 준비하고 있습니다." });
    try {
      const response = await fetch("/api/backup/full", { cache: "no-store" });
      const content = await response.text();
      if (!response.ok) {
        let payload = {};
        try { payload = JSON.parse(content); } catch {}
        throw new Error(payload.error || payload.message || `다운로드 실패 (${response.status})`);
      }
      const disposition = response.headers.get("content-disposition") || "";
      const matchedName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
      downloadFile(matchedName || `PB_full_backup_${toStr(new Date())}.json`, content, "application/json;charset=utf-8");
      setTransferState({ status: "success", message: "전체 데이터 파일 다운로드가 완료되었습니다." });
    } catch (error) {
      setTransferState({ status: "error", message: `다운로드 실패: ${String(error?.message || error)}` });
    }
  };

  const selectFullBackup = async (file) => {
    try {
      setTransferState({ status: "working", message: "백업 파일을 검사하고 있습니다." });
      const document = JSON.parse(await file.text());
      const parsed = parseFullBackup(document, { allowLegacy: true });
      setPendingRestore({
        document,
        data: parsed.data,
        summary: parsed.summary,
        legacy: parsed.legacy,
        fileName: file.name,
        fileSize: file.size
      });
      setRestoreConfirmation("");
      setTransferState({ status: "idle", message: "" });
    } catch (error) {
      setPendingRestore(null);
      setTransferState({ status: "error", message: `파일 검사 실패: ${String(error?.message || error)}` });
    }
  };

  const restoreFullBackup = async () => {
    if (!pendingRestore || restoreConfirmation !== "전체 데이터를 교체합니다") return;
    setTransferState({ status: "working", message: "전체 데이터를 저장소에 복원하고 있습니다." });
    try {
      const response = await fetch("/api/backup/full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup: pendingRestore.document })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || payload.message || `복원 실패 (${response.status})`);
      }
      onRestore({
        projects: pendingRestore.data.projects,
        adminLogs: pendingRestore.data.adminLogs,
        supplyPriceItems: pendingRestore.data.supplyPriceItems,
        marketAnalysisDefaults: pendingRestore.data.marketAnalysisDefaults,
        selectedId: pendingRestore.data.projects[0]?.id || null
      });
      setPendingRestore(null);
      setRestoreConfirmation("");
      setTransferState({ status: "success", message: `전체 데이터 복원이 완료되었습니다. 프로젝트 ${payload.summary.projectCount}건, 공급단가 ${payload.summary.supplyPriceItemCount}건` });
    } catch (error) {
      setTransferState({ status: "error", message: `복원 실패: ${String(error?.message || error)}` });
    }
  };

  const moduleFileStamp = () => new Date().toISOString().replace(/[:.]/g, "-");

  const downloadModuleBackup = (moduleType) => {
    if (!isAdmin) return;
    const backup = createModuleBackup(
      moduleType,
      { projects, adminLogs, supplyPriceItems, marketAnalysisDefaults },
      { source: "data-transfer-tab" }
    );
    downloadFile(
      `PB_${MODULE_BACKUP_TYPES[moduleType]}_${moduleFileStamp()}.json`,
      JSON.stringify(backup, null, 2),
      "application/json;charset=utf-8"
    );
    setTransferState({ status: "success", message: `${MODULE_BACKUP_TYPES[moduleType]} 전용 데이터 파일 다운로드가 완료되었습니다.` });
  };

  const downloadModuleCsv = (moduleType) => {
    const categoryLabelById = Object.fromEntries(SUPPLY_PRICE_CATEGORIES.map((category) => [category.id, category.label]));
    const csv = moduleType === "development"
      ? developmentModuleToCsv(projects, adminLogs)
      : (moduleType === "supply"
          ? supplyModuleToCsv(supplyPriceItems, categoryLabelById)
          : (moduleType === "distribution"
              ? distributionModuleToCsv(supplyPriceItems)
              : marketModuleToCsv(supplyPriceItems, marketAnalysisDefaults)));
    downloadFile(
      `PB_${MODULE_BACKUP_TYPES[moduleType]}_${moduleFileStamp()}.csv`,
      `\uFEFF${csv}`,
      "text/csv;charset=utf-8"
    );
    setTransferState({ status: "success", message: `${MODULE_BACKUP_TYPES[moduleType]} 통합 CSV 다운로드가 완료되었습니다.` });
  };

  const restoreModuleBackup = async (moduleType, file) => {
    if (!isAdmin) return;
    try {
      setTransferState({ status: "working", message: `${MODULE_BACKUP_TYPES[moduleType]} 백업 파일을 검사하고 있습니다.` });
      const parsed = parseModuleBackup(JSON.parse(await file.text()), moduleType);
      if (!window.confirm(
        `${parsed.moduleLabel} 데이터 ${parsed.recordCount}건을 복원하시겠습니까?\n\n다른 탭 데이터는 유지됩니다. 복원 전 현재 데이터를 먼저 내려받아 보관하세요.`
      )) {
        setTransferState({ status: "idle", message: "" });
        return;
      }

      if (moduleType === "development") {
        const nextProjects = normalizeProjects(parsed.data.projects);
        onRestore({
          projects: nextProjects,
          adminLogs: normalizeAdminLogs(parsed.data.adminLogs),
          selectedId: nextProjects[0]?.id || null
        });
        setTransferState({ status: "success", message: `제품개발 전체 데이터 ${nextProjects.length}건 복원이 완료되었습니다.` });
        return;
      }

      const currentItems = normalizeSupplyPriceItems(supplyPriceItems);
      const currentById = new Map(currentItems.map((item) => [String(item.id), item]));
      const currentByIdentity = new Map(currentItems.map((item) => [supplyItemIdentityKey(item), item]));

      if (moduleType === "supply") {
        const nextItems = normalizeSupplyPriceItems(parsed.data.supplyPriceItems).map((item) => {
          const current = currentById.get(String(item.id)) || currentByIdentity.get(supplyItemIdentityKey(item));
          return normalizeSupplyPriceItem({
            ...item,
            distributionStructure: current?.distributionStructure || item.distributionStructure,
            marketSizeAnalysis: current?.marketSizeAnalysis || item.marketSizeAnalysis
          });
        });
        onRestore({ supplyPriceItems: nextItems });
        setTransferState({ status: "success", message: `공급단가 전체 데이터 ${nextItems.length}건 복원이 완료되었습니다. 기존 유통 구조와 시장 분석은 연결 가능한 건에 유지했습니다.` });
        return;
      }

      const isDistributionRestore = moduleType === "distribution";
      const linkedRecords = isDistributionRestore ? parsed.data.distributionItems : parsed.data.marketItems;
      const recordsById = new Map(linkedRecords.map((record) => [String(record.supplyItemId), record]));
      const recordsByIdentity = new Map(linkedRecords.map((record) => [String(record.identityKey || ""), record]));
      const matchedRecordIds = new Set();
      const nextItems = currentItems.map((item) => {
        const record = recordsById.get(String(item.id)) || recordsByIdentity.get(supplyItemIdentityKey(item));
        if (!record) return item;
        matchedRecordIds.add(record);
        return normalizeSupplyPriceItem(isDistributionRestore
          ? { ...item, distributionStructure: record.distributionStructure }
          : { ...item, marketSizeAnalysis: record.marketSizeAnalysis });
      });
      onRestore({
        supplyPriceItems: nextItems,
        ...(isDistributionRestore ? {} : { marketAnalysisDefaults: parsed.data.marketAnalysisDefaults })
      });
      const unmatchedCount = linkedRecords.length - matchedRecordIds.size;
      const restoreLabel = isDistributionRestore ? "유통 구조" : "시장 규모 분석";
      setTransferState({
        status: unmatchedCount > 0 ? "warning" : "success",
        message: `${restoreLabel} ${matchedRecordIds.size}건 복원이 완료되었습니다.${unmatchedCount > 0 ? ` 연결할 공급단가가 없는 ${unmatchedCount}건은 제외했습니다. 공급단가 데이터를 먼저 복원해주세요.` : ""}`
      });
    } catch (error) {
      setTransferState({ status: "error", message: `${MODULE_BACKUP_TYPES[moduleType]} 복원 실패: ${String(error?.message || error)}` });
    }
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>전체 데이터 이전</div>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 10 }}>
          프로젝트, 이력, 공급단가, 첨부파일을 하나의 전체 백업 파일로 이전합니다.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isAdmin && <button onClick={downloadFullBackup} disabled={transferState.status === "working"} style={primaryButton}>전체 파일 데이터 다운로드</button>}
          {isAdmin && <button onClick={() => fullBackupInputRef.current?.click()} disabled={transferState.status === "working"} style={subtleButton}>전체 파일 데이터 업로드</button>}
        </div>
        {transferState.message && (
          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: transferState.status === "error" ? "#dc2626" : (transferState.status === "success" ? "#047857" : "#475569") }}>
            {transferState.message}
          </div>
        )}
        {!isAdmin && <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>전체 데이터 이전은 ADMIN 권한에서만 가능합니다.</div>}
        {isAdmin && <input
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          ref={fullBackupInputRef}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) selectFullBackup(file);
            event.target.value = "";
          }}
        />}
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>탭별 데이터 이전 및 CSV 보조 백업</div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
          각 탭의 전체 데이터를 독립적으로 내려받고 복원합니다. CSV는 조회·가공용이며 정확한 복원에는 JSON 데이터 파일을 사용하세요.
        </div>
        <div style={{ border: "1px solid #dbe3ee", borderRadius: 8, overflow: "hidden" }}>
          {[
            { id: "development", description: "모든 프로젝트, 태스크, 일정과 이력 기록" },
            { id: "supply", description: "전체 공급단가, 견적 정보와 첨부파일" },
            { id: "distribution", description: "물량별 가격대, 마진 설정과 경쟁제품 비교" },
            { id: "market", description: "5개년 시장 실적, 약국 침투율, 배치 소진과 금융비용" }
          ].map((module, index) => (
            <div
              key={module.id}
              style={{
                display: "grid",
                gridTemplateColumns: "180px minmax(260px, 1fr) auto",
                gap: 12,
                alignItems: "center",
                padding: "12px 13px",
                background: index % 2 === 0 ? "#fff" : "#f8fafc",
                borderBottom: index < 3 ? "1px solid #e2e8f0" : "none"
              }}
            >
              <div style={{ color: "#0f172a", fontSize: 14, fontWeight: 900 }}>{MODULE_BACKUP_TYPES[module.id]}</div>
              <div style={{ color: "#64748b", fontSize: 12 }}>{module.description}</div>
              <div style={{ display: "flex", gap: 7, justifyContent: "flex-end", flexWrap: "wrap" }}>
                {isAdmin && (
                  <button onClick={() => downloadModuleBackup(module.id)} disabled={transferState.status === "working"} style={primaryButton}>
                    데이터 다운로드
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => moduleBackupInputRefs.current[module.id]?.click()} disabled={transferState.status === "working"} style={subtleButton}>
                    데이터 복원
                  </button>
                )}
                <button onClick={() => downloadModuleCsv(module.id)} style={subtleButton}>통합 CSV</button>
                {isAdmin && (
                  <input
                    type="file"
                    accept=".json,application/json"
                    style={{ display: "none" }}
                    ref={(element) => { moduleBackupInputRefs.current[module.id] = element; }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) restoreModuleBackup(module.id, file);
                      event.target.value = "";
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        {!isAdmin && <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>JSON 데이터 다운로드와 복원은 ADMIN만 가능하며, 통합 CSV는 조회용으로 내려받을 수 있습니다.</div>}
      </div>
      {pendingRestore && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15, 23, 42, .56)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "min(520px, 100%)", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, padding: 18, boxShadow: "0 18px 50px rgba(15, 23, 42, .25)" }}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>전체 데이터 교체 확인</div>
            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, marginBottom: 12 }}>
              현재 저장된 모든 데이터가 선택한 파일의 내용으로 교체됩니다. 복원 전 현재 데이터 파일을 먼저 다운로드해 보관하세요.
            </div>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, display: "grid", gap: 4, fontSize: 12, marginBottom: 12 }}>
              <div><strong>파일:</strong> {pendingRestore.fileName} ({(pendingRestore.fileSize / 1024 / 1024).toFixed(2)}MB)</div>
              <div><strong>프로젝트:</strong> {pendingRestore.summary.projectCount}건 · <strong>이력:</strong> {pendingRestore.summary.adminLogCount}건</div>
              <div><strong>공급단가:</strong> {pendingRestore.summary.supplyPriceItemCount}건 · <strong>첨부파일:</strong> {pendingRestore.summary.attachmentCount}개</div>
            </div>
            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800 }}>
              계속하려면 아래 입력창에 ‘전체 데이터를 교체합니다’를 입력하세요.
              <input value={restoreConfirmation} onChange={(event) => setRestoreConfirmation(event.target.value)} style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }} />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button onClick={() => { setPendingRestore(null); setRestoreConfirmation(""); }} disabled={transferState.status === "working"} style={subtleButton}>취소</button>
              <button onClick={restoreFullBackup} disabled={restoreConfirmation !== "전체 데이터를 교체합니다" || transferState.status === "working"} style={{ ...primaryButton, opacity: restoreConfirmation === "전체 데이터를 교체합니다" ? 1 : 0.45 }}>전체 데이터 복원</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BasicInfoTab({ project, onSave }) {
  const [form, setForm] = useState({
    name: project.name || "",
    desc: project.desc || "",
    pmName: project.pmName || "",
    amName: project.amName || "",
    category: project.category || CATEGORIES[0],
    regulatoryDirection: project.regulatoryDirection || "",
    exclusivityType: project.exclusivityType || "",
    start: project.start || TODAY,
    draftChecklist: normalizeDraftChecklist(project.draftChecklist)
  });
  const categoryOptions = CATEGORIES.includes(form.category) ? CATEGORIES : [form.category, ...CATEGORIES];
  const showRegulatoryFields = isOtcEtcCategory(form.category);

  useEffect(() => {
    setForm({
      name: project.name || "",
      desc: project.desc || "",
      pmName: project.pmName || "",
      amName: project.amName || "",
      category: project.category || CATEGORIES[0],
      regulatoryDirection: project.regulatoryDirection || "",
      exclusivityType: project.exclusivityType || "",
      start: project.start || TODAY,
      draftChecklist: normalizeDraftChecklist(project.draftChecklist)
    });
  }, [project.id, project.name, project.desc, project.pmName, project.amName, project.category, project.regulatoryDirection, project.exclusivityType, project.start, project.draftChecklist]);

  const updateChecklist = (key, value) => {
    setForm((prev) => ({
      ...prev,
      draftChecklist: {
        ...prev.draftChecklist,
        [key]: value
      }
    }));
  };

  const metaLogs = (project.changeLog || [])
    .filter((log) => log?.type === "project_meta")
    .slice()
    .reverse();

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>프로젝트 기본정보 수정</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>프로젝트명</label>
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>카테고리</label>
            <select
              value={form.category}
              onChange={(event) => {
                const category = event.target.value;
                setForm((prev) => ({
                  ...prev,
                  category,
                  regulatoryDirection: isOtcEtcCategory(category) ? prev.regulatoryDirection : "",
                  exclusivityType: isOtcEtcCategory(category) ? prev.exclusivityType : ""
                }));
              }}
              style={inputStyle}
            >
              {categoryOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          {showRegulatoryFields && <>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>허가/생산 방향성</label>
              <select value={form.regulatoryDirection} onChange={(event) => setForm((prev) => ({ ...prev, regulatoryDirection: event.target.value }))} style={inputStyle}>
                <option value="">선택</option>
                {REGULATORY_DIRECTION_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>독점 구분</label>
              <select value={form.exclusivityType} onChange={(event) => setForm((prev) => ({ ...prev, exclusivityType: event.target.value }))} style={inputStyle}>
                <option value="">선택</option>
                {EXCLUSIVITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </>}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>PM</label>
            <input value={form.pmName} onChange={(event) => setForm((prev) => ({ ...prev, pmName: event.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>AM</label>
            <input value={form.amName} onChange={(event) => setForm((prev) => ({ ...prev, amName: event.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>시작일</label>
            <input type="date" value={form.start} onChange={(event) => setForm((prev) => ({ ...prev, start: event.target.value }))} style={inputStyle} />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>기안 요약</label>
          <textarea
            rows={3}
            value={form.desc}
            onChange={(event) => setForm((prev) => ({ ...prev, desc: event.target.value }))}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>
        <div style={{ marginTop: 14, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>사전 체크리스트 및 기안내용</div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
            수정 저장 시 변경된 항목이 기본정보 변경 이력에 남습니다.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            {DRAFT_CHECKLIST_FIELDS.map((field) => (
              <div key={field.key}>
                <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>{field.label}</label>
                <textarea
                  rows={4}
                  value={form.draftChecklist[field.key] || ""}
                  onChange={(event) => updateChecklist(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  style={{ ...inputStyle, resize: "vertical", minHeight: 88 }}
                />
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => {
              const nextName = form.name.trim();
              const nextDesc = form.desc.trim();
              const nextPm = form.pmName.trim();
              const nextAm = form.amName.trim();
              if (!nextName) {
                window.alert("프로젝트명을 입력해주세요.");
                return;
              }
              if (!nextPm && !nextAm) {
                window.alert("PM 또는 AM 중 최소 1명을 입력해주세요.");
                return;
              }
              onSave({
                name: nextName,
                desc: nextDesc,
                pmName: nextPm,
                amName: nextAm,
                category: form.category,
                regulatoryDirection: showRegulatoryFields ? form.regulatoryDirection : "",
                exclusivityType: showRegulatoryFields ? form.exclusivityType : "",
                start: form.start || TODAY,
                draftChecklist: normalizeDraftChecklist(form.draftChecklist)
              });
            }}
            style={primaryButton}
          >
            기본정보 저장
          </button>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>기본정보 변경 이력</div>
        <div style={{ display: "grid", gap: 6 }}>
          {metaLogs.map((log) => (
            <div key={log.id} style={{ fontSize: 12, color: "#475569", background: "#f8fafc", borderRadius: 6, padding: "7px 10px" }}>
              {fmt(log.date)} · {log.reason}
            </div>
          ))}
          {metaLogs.length === 0 && (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>변경 이력이 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdvisorTab({ project, onSaveLog }) {
  const emptyForm = {
    name: "",
    datetime: "",
    content: ""
  };
  const [form, setForm] = useState({
    name: "",
    datetime: "",
    content: ""
  });
  const [editingId, setEditingId] = useState(null);
  const logs = project.advisorLog || [];

  const save = () => {
    const name = form.name.trim();
    const datetime = form.datetime;
    const content = form.content.trim();
    if (!name || !datetime || !content) {
      window.alert("이름, 일시, 대화내용을 모두 입력해주세요.");
      return;
    }
    onSaveLog({
      id: editingId || Date.now(),
      name,
      datetime,
      content,
      updatedAt: editingId ? new Date().toISOString() : undefined
    });
    setEditingId(null);
    setForm(emptyForm);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      datetime: item.datetime || "",
      content: item.content || ""
    });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14 }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>{editingId ? "자문약사 의견 수정" : "자문약사 의견 입력"}</div>
        <div style={{ display: "grid", gap: 8 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>이름</label>
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>일시</label>
            <input type="datetime-local" value={form.datetime} onChange={(event) => setForm((prev) => ({ ...prev, datetime: event.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", marginBottom: 4 }}>대화내용</label>
            <textarea rows={5} value={form.content} onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <button onClick={save} style={primaryButton}>{editingId ? "수정 저장" : "저장"}</button>
          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
              style={subtleButton}
            >
              수정 취소
            </button>
          )}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>자문약사 기록 ({logs.length}건)</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>CSV는 최상단 데이터 이전 탭에서 일괄 내보내기</div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {[...logs].reverse().map((log) => (
            <div key={log.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontWeight: 800 }}>{log.name}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{log.datetime}</div>
              </div>
              <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{log.content}</div>
              <div style={{ marginTop: 8 }}>
                <button onClick={() => startEdit(log)} style={subtleButton}>수정</button>
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>저장된 자문약사 의견이 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function dashboardRevisionOrder(value) {
  const parsed = Number(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDashboardRevision(value) {
  const raw = String(value || "").trim();
  if (!raw) return "회차 미입력";
  return /회차$/i.test(raw) || /^v/i.test(raw) ? raw : `${raw}회차`;
}

function parseDashboardChanges(value) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function toDashboardDateTimeInput(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const localDate = new Date(safeDate.getTime() - safeDate.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function formatDashboardChangeDateTime(entry) {
  const value = entry?.changeDateTime || entry?.createdAt || entry?.changeDate;
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "-";
  const twoDigits = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}.${twoDigits(date.getMonth() + 1)}.${twoDigits(date.getDate())} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

function DashboardChangeLogSection({ entries, isAdmin, onAdd, onUpdate, onDelete }) {
  const sortedEntries = useMemo(() => [...(entries || [])].sort((left, right) => {
    const revisionDiff = dashboardRevisionOrder(right.revision) - dashboardRevisionOrder(left.revision);
    if (revisionDiff !== 0) return revisionDiff;
    return String(right.changeDateTime || right.createdAt || right.changeDate || "")
      .localeCompare(String(left.changeDateTime || left.createdAt || left.changeDate || ""));
  }), [entries]);
  const nextRevision = useMemo(() => (
    sortedEntries.reduce((highest, entry) => Math.max(highest, Math.floor(dashboardRevisionOrder(entry.revision))), 0) + 1
  ), [sortedEntries]);
  const [isCreating, setIsCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState({ changeDateTime: toDashboardDateTimeInput(), revision: "", changes: "" });
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ changeDateTime: "", revision: "", changes: "" });

  const openCreate = () => {
    setCreateDraft({ changeDateTime: toDashboardDateTimeInput(), revision: String(nextRevision), changes: "" });
    setIsCreating(true);
  };

  const submitCreate = () => {
    const changes = parseDashboardChanges(createDraft.changes);
    if (!createDraft.changeDateTime || !createDraft.revision.trim() || changes.length === 0) {
      window.alert("변경일시, 수정회차, 변경사항을 모두 입력해주세요.");
      return;
    }
    onAdd?.({ ...createDraft, changes });
    setIsCreating(false);
    setCreateDraft({ changeDateTime: toDashboardDateTimeInput(), revision: "", changes: "" });
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditDraft({
      changeDateTime: entry.changeDateTime
        || toDashboardDateTimeInput(entry.createdAt || entry.changeDate || new Date()),
      revision: String(entry.revision || ""),
      changes: (entry.changes || []).join("\n")
    });
  };

  const submitEdit = (entryId) => {
    const changes = parseDashboardChanges(editDraft.changes);
    if (!editDraft.changeDateTime || !editDraft.revision.trim() || changes.length === 0) {
      window.alert("변경일시, 수정회차, 변경사항을 모두 입력해주세요.");
      return;
    }
    onUpdate?.(entryId, { ...editDraft, changes });
    setEditingId(null);
  };

  const formFields = (draft, setDraft) => (
    <div style={{ display: "grid", gridTemplateColumns: "200px 170px minmax(0, 1fr)", gap: 10, alignItems: "start" }}>
      <div>
        <label style={{ display: "block", marginBottom: 5, color: "#475569", fontSize: 12, fontWeight: 800 }}>변경일시</label>
        <input
          type="datetime-local"
          value={draft.changeDateTime}
          onChange={(event) => setDraft((previous) => ({ ...previous, changeDateTime: event.target.value }))}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={{ display: "block", marginBottom: 5, color: "#475569", fontSize: 12, fontWeight: 800 }}>수정회차</label>
        <input value={draft.revision} onChange={(event) => setDraft((previous) => ({ ...previous, revision: event.target.value }))} placeholder="예: 12 또는 v1.2" style={inputStyle} />
      </div>
      <div>
        <label style={{ display: "block", marginBottom: 5, color: "#475569", fontSize: 12, fontWeight: 800 }}>변경사항</label>
        <textarea
          value={draft.changes}
          onChange={(event) => setDraft((previous) => ({ ...previous, changes: event.target.value }))}
          placeholder={"변경사항을 한 줄에 하나씩 입력하세요.\n예: 공급단가 삭제 권한을 ADMIN으로 제한"}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
        />
      </div>
    </div>
  );

  return (
    <section style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "13px 15px", background: "#f8fafc", borderBottom: "1px solid #dbe3ee" }}>
        <div>
          <div style={{ color: "#0f172a", fontSize: 16, fontWeight: 900 }}>제품개발 대시보드 변경사항</div>
          <div style={{ marginTop: 3, color: "#64748b", fontSize: 12 }}>일시와 수정회차별 업데이트 내용을 확인합니다.</div>
        </div>
        {isAdmin && !isCreating && (
          <button onClick={openCreate} style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", cursor: "pointer", fontSize: 12, fontWeight: 800 }}>
            + 변경사항 기록
          </button>
        )}
      </div>

      {isAdmin && isCreating && (
        <div style={{ padding: 14, background: "#f8fafc", borderBottom: "1px solid #dbe3ee" }}>
          {formFields(createDraft, setCreateDraft)}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 7, marginTop: 10 }}>
            <button onClick={() => setIsCreating(false)} style={subtleButton}>취소</button>
            <button onClick={submitCreate} style={primaryButton}>기록 저장</button>
          </div>
        </div>
      )}

      <div>
        {sortedEntries.map((entry) => {
          const editing = String(editingId) === String(entry.id);
          return (
            <div key={entry.id} style={{ padding: "13px 15px", borderBottom: "1px solid #e2e8f0" }}>
              {editing ? (
                <>
                  {formFields(editDraft, setEditDraft)}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 7, marginTop: 10 }}>
                    <button onClick={() => setEditingId(null)} style={subtleButton}>취소</button>
                    <button onClick={() => submitEdit(entry.id)} style={primaryButton}>수정 완료</button>
                  </div>
                </>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "120px 150px minmax(0, 1fr) auto", gap: 14, alignItems: "start" }}>
                  <div style={{ color: "#0f172a", fontSize: 13, fontWeight: 900 }}>{formatDashboardRevision(entry.revision)}</div>
                  <div style={{ color: "#64748b", fontSize: 12, whiteSpace: "nowrap" }}>{formatDashboardChangeDateTime(entry)}</div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", fontSize: 13, lineHeight: 1.65 }}>
                    {(entry.changes || []).map((change, index) => <li key={`${entry.id}_${index}`}>{change}</li>)}
                  </ul>
                  {isAdmin && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => startEdit(entry)} style={subtleButton}>수정</button>
                      <button
                        onClick={() => {
                          if (window.confirm("이 변경사항 기록을 삭제하시겠습니까?")) onDelete?.(entry.id);
                        }}
                        style={{ ...subtleButton, borderColor: "#fecaca", color: "#dc2626" }}
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {sortedEntries.length === 0 && (
          <div style={{ padding: 18, color: "#94a3b8", fontSize: 12, textAlign: "center" }}>아직 등록된 대시보드 변경사항이 없습니다.</div>
        )}
      </div>
    </section>
  );
}

function ProductDevelopmentDashboardTab({
  projects,
  onOpenProject,
  onReminderYes,
  onReminderNo
}) {
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
        <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>제품개발 대시보드</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          현재 단계 리마인드를 확인하고, 문제가 있으면 바로 지연 적용 팝업으로 이동할 수 있습니다.
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
                  담당: {formatOwners(project)} · 카테고리: {project.category}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>현재 단계</div>
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
                지연 태스크 {delayedCount}건
                {lastCheck && (
                  <span style={{ marginLeft: 8 }}>
                    최근 점검: {lastCheck.answer === "yes" ? "Y" : "N"} ({new Date(lastCheck.date).toLocaleString()})
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
            표시할 프로젝트가 없습니다.
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
    if (type === "project_create") return "신설";
    if (type === "project_delete") return "삭제";
    if (type === "schedule_version_change") return "일정 버전";
    if (type === "task_start_date_change") return "태스크 일정";
    if (type === "task_status_change") return "태스크 상태";
    if (type === "project_start_date_change") return "프로젝트 날짜";
    if (type === "basic_info_update") return "기본정보";
    if (type === "advisor_log_add") return "자문약사";
    if (type === "communication_log_add") return "업체소통";
    if (type === "decision_log_add") return "의사결정";
    if (type === "stage_check_yes") return "점검(Y)";
    if (type === "stage_check_issue") return "점검(N)";
    return "기록";
  };

  const typeColor = (type) => {
    if (type === "project_create") return { fg: "#166534", bg: "#dcfce7" };
    if (type === "project_delete") return { fg: "#b91c1c", bg: "#fee2e2" };
    if (type === "schedule_version_change") return { fg: "#1d4ed8", bg: "#dbeafe" };
    if (type === "task_start_date_change" || type === "project_start_date_change") return { fg: "#1d4ed8", bg: "#dbeafe" };
    if (type === "task_status_change") return { fg: "#0f766e", bg: "#ccfbf1" };
    if (type === "basic_info_update") return { fg: "#7c3aed", bg: "#f3e8ff" };
    if (type === "advisor_log_add" || type === "communication_log_add" || type === "decision_log_add") return { fg: "#0f766e", bg: "#ccfbf1" };
    if (type === "stage_check_yes") return { fg: "#166534", bg: "#dcfce7" };
    if (type === "stage_check_issue") return { fg: "#b91c1c", bg: "#fee2e2" };
    return { fg: "#475569", bg: "#e2e8f0" };
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>현재 프로젝트 이력 로그</div>
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
                  <span style={{ fontSize: 11, color: "#64748b" }}>{log.actor || "관리자"}</span>
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
                    if (!window.confirm("이 로그를 삭제하시겠습니까?")) return;
                    onDeleteLog(log.id);
                  }}
                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #fecaca", background: "#fff", color: "#dc2626", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                >
                  로그 삭제
                </button>}
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
        {sortedLogs.length === 0 && (
          <div style={{ fontSize: 12, color: "#94a3b8" }}>아직 기록된 프로젝트 신설/삭제 로그가 없습니다.</div>
        )}
      </div>
    </div>
  );
}

export default function PmsApp() {
  const router = useRouter();
  const {
    projects,
    setProjects,
    adminLogs,
    setAdminLogs,
    supplyPriceItems,
    setSupplyPriceItems,
    marketAnalysisDefaults,
    setMarketAnalysisDefaults,
    syncState
  } = useProjectsStore();
  const [userRole, setUserRole] = useState(ROLE_GUEST);
  const [moduleTab, setModuleTab] = useState("development");
  const [supplyCategory, setSupplyCategory] = useState("all");
  const [selectedDistributionItemId, setSelectedDistributionItemId] = useState(null);
  const [selectedMarketItemId, setSelectedMarketItemId] = useState(null);
  const [focusedSupplyItemId, setFocusedSupplyItemId] = useState(null);
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
  const dashboardChangeLogs = useMemo(() => (
    (adminLogs || []).filter((log) => log.type === DASHBOARD_CHANGE_NOTICE_TYPE)
  ), [adminLogs]);

  const appendAdminLog = (entry) => {
    setAdminLogs((prev) => normalizeAdminLogs([
      ...(prev || []),
      {
        id: Date.now() + Math.floor(Math.random() * 1000),
        actor: "관리자",
        createdAt: new Date().toISOString(),
        ...entry
      }
    ]));
  };

  useEffect(() => {
    if (syncState.status === "loading" || dashboardChangeLogs.length > 0 || typeof window === "undefined") return;
    if (window.localStorage.getItem(DASHBOARD_CHANGELOG_SEED_KEY)) return;
    window.localStorage.setItem(DASHBOARD_CHANGELOG_SEED_KEY, "1");
    setAdminLogs((previous) => normalizeAdminLogs([
      ...(previous || []),
      {
        id: `dashboard_change_${Date.now()}`,
        type: DASHBOARD_CHANGE_NOTICE_TYPE,
        projectName: "제품개발 대시보드",
        revision: "1",
        changeDate: TODAY,
        changes: [
          "공급단가 견적의 채택 예상·채택 재고 표시와 ADMIN 전용 삭제 권한을 적용했습니다.",
          "유통 구조 설정의 허가사 수수료 표기와 경쟁제품 비교 항목을 개선했습니다.",
          "온라인 및 PC용 화면에 동일한 변경사항을 반영했습니다."
        ],
        actor: "시스템",
        createdAt: new Date().toISOString()
      }
    ]));
  }, [dashboardChangeLogs.length, setAdminLogs, syncState.status]);

  useEffect(() => {
    if (syncState.status === "loading" || typeof window === "undefined") return;
    if (window.localStorage.getItem(DASHBOARD_PRICING_TABS_SEED_KEY)) return;
    window.localStorage.setItem(DASHBOARD_PRICING_TABS_SEED_KEY, "1");
    setAdminLogs((previous) => {
      if ((previous || []).some((log) => log.id === "dashboard_change_20260724_pricing_tabs")) return previous;
      const nextRevision = (previous || [])
        .filter((log) => log.type === DASHBOARD_CHANGE_NOTICE_TYPE)
        .reduce((highest, log) => Math.max(highest, Math.floor(dashboardRevisionOrder(log.revision))), 0) + 1;
      return normalizeAdminLogs([
        ...(previous || []),
        {
          id: "dashboard_change_20260724_pricing_tabs",
          type: DASHBOARD_CHANGE_NOTICE_TYPE,
          projectName: "제품개발 대시보드",
          revision: String(nextRevision),
          changeDate: TODAY,
          changes: [
            "유통 구조 설정에 물량 구간별 판매가·마진 가격대 탭을 추가했습니다.",
            "가격대별 적용 최소 물량, 참약사 마진율, 약국 판매가를 독립적으로 저장하도록 개선했습니다.",
            "유통 구조 공급단가 건 목록에 성분 함량을 함께 표시했습니다."
          ],
          actor: "시스템",
          createdAt: new Date().toISOString()
        }
      ]);
    });
  }, [setAdminLogs, syncState.status]);

  useEffect(() => {
    if (syncState.status === "loading" || typeof window === "undefined") return;
    if (window.localStorage.getItem(DASHBOARD_MODULE_BACKUP_SEED_KEY)) return;
    window.localStorage.setItem(DASHBOARD_MODULE_BACKUP_SEED_KEY, "1");
    setAdminLogs((previous) => {
      if ((previous || []).some((log) => log.id === "dashboard_change_20260724_module_backup")) return previous;
      const nextRevision = (previous || [])
        .filter((log) => log.type === DASHBOARD_CHANGE_NOTICE_TYPE)
        .reduce((highest, log) => Math.max(highest, Math.floor(dashboardRevisionOrder(log.revision))), 0) + 1;
      return normalizeAdminLogs([
        ...(previous || []),
        {
          id: "dashboard_change_20260724_module_backup",
          type: DASHBOARD_CHANGE_NOTICE_TYPE,
          projectName: "제품개발 대시보드",
          revision: String(nextRevision),
          changeDate: TODAY,
          changes: [
            "제품개발·공급단가·유통 구조 설정 탭별 JSON 데이터 다운로드와 복원 기능을 추가했습니다.",
            "각 탭의 전체 내용을 한 파일로 확인할 수 있는 통합 CSV 보조 백업을 추가했습니다.",
            "유통 구조 설정에서 연결된 공급단가 건으로 돌아가는 양방향 이동 기능을 추가했습니다."
          ],
          actor: "시스템",
          createdAt: new Date().toISOString()
        }
      ]);
    });
  }, [setAdminLogs, syncState.status]);

  useEffect(() => {
    if (syncState.status === "loading" || typeof window === "undefined") return;
    if (window.localStorage.getItem(DASHBOARD_PROJECT_BACKUP_REMOVAL_SEED_KEY)) return;
    window.localStorage.setItem(DASHBOARD_PROJECT_BACKUP_REMOVAL_SEED_KEY, "1");
    setAdminLogs((previous) => {
      if ((previous || []).some((log) => log.id === "dashboard_change_20260724_project_backup_removal")) return previous;
      const nextRevision = (previous || [])
        .filter((log) => log.type === DASHBOARD_CHANGE_NOTICE_TYPE)
        .reduce((highest, log) => Math.max(highest, Math.floor(dashboardRevisionOrder(log.revision))), 0) + 1;
      return normalizeAdminLogs([
        ...(previous || []),
        {
          id: "dashboard_change_20260724_project_backup_removal",
          type: DASHBOARD_CHANGE_NOTICE_TYPE,
          projectName: "제품개발 대시보드",
          revision: String(nextRevision),
          changeDate: TODAY,
          changes: [
            "개별 프로젝트의 백업/복원 미니탭을 제거했습니다.",
            "제품개발 전체 백업·복원과 통합 CSV 기능을 최상단 데이터 이전 탭으로 일원화했습니다."
          ],
          actor: "시스템",
          createdAt: new Date().toISOString()
        }
      ]);
    });
  }, [setAdminLogs, syncState.status]);

  useEffect(() => {
    if (syncState.status === "loading" || typeof window === "undefined") return;
    if (window.localStorage.getItem(DASHBOARD_HOME_SPLIT_SEED_KEY)) return;
    window.localStorage.setItem(DASHBOARD_HOME_SPLIT_SEED_KEY, "1");
    setAdminLogs((previous) => {
      if ((previous || []).some((log) => log.id === "dashboard_change_20260724_home_split")) return previous;
      const nextRevision = (previous || [])
        .filter((log) => log.type === DASHBOARD_CHANGE_NOTICE_TYPE)
        .reduce((highest, log) => Math.max(highest, Math.floor(dashboardRevisionOrder(log.revision))), 0) + 1;
      return normalizeAdminLogs([
        ...(previous || []),
        {
          id: "dashboard_change_20260724_home_split",
          type: DASHBOARD_CHANGE_NOTICE_TYPE,
          projectName: "제품개발 대시보드",
          revision: String(nextRevision),
          changeDate: TODAY,
          changeDateTime: toDashboardDateTimeInput(),
          changes: [
            "최상단에 독립적인 홈 탭을 추가하고 제품개발 대시보드 변경사항을 홈으로 이동했습니다.",
            "제품개발 탭은 프로젝트 진행 현황과 단계 리마인드만 표시하도록 정리했습니다.",
            "왼쪽 홈 버튼이 새 홈 탭으로 이동하도록 변경했습니다.",
            "변경사항 기록에 년·월·일과 시·분을 함께 표시하도록 개선했습니다."
          ],
          actor: "시스템",
          createdAt: new Date().toISOString()
        }
      ]);
    });
  }, [setAdminLogs, syncState.status]);

  useEffect(() => {
    if (syncState.status === "loading" || typeof window === "undefined") return;
    if (window.localStorage.getItem(DASHBOARD_HOME_BUTTON_STYLE_SEED_KEY)) return;
    window.localStorage.setItem(DASHBOARD_HOME_BUTTON_STYLE_SEED_KEY, "1");
    setAdminLogs((previous) => {
      if ((previous || []).some((log) => log.id === "dashboard_change_20260724_home_button_style")) return previous;
      const nextRevision = (previous || [])
        .filter((log) => log.type === DASHBOARD_CHANGE_NOTICE_TYPE)
        .reduce((highest, log) => Math.max(highest, Math.floor(dashboardRevisionOrder(log.revision))), 0) + 1;
      return normalizeAdminLogs([
        ...(previous || []),
        {
          id: "dashboard_change_20260724_home_button_style",
          type: DASHBOARD_CHANGE_NOTICE_TYPE,
          projectName: "제품개발 대시보드",
          revision: String(nextRevision),
          changeDate: TODAY,
          changeDateTime: toDashboardDateTimeInput(),
          changes: [
            "상단 홈 탭과 왼쪽 홈 버튼의 크기를 줄였습니다.",
            "홈 진입 버튼을 하늘색 계열로 구분해 검정 내비게이션에서 쉽게 찾을 수 있도록 개선했습니다.",
            "유통 구조 설정의 공급단가 목록에 포장단위와 포장형태를 표시하도록 개선했습니다."
          ],
          actor: "시스템",
          createdAt: new Date().toISOString()
        }
      ]);
    });
  }, [setAdminLogs, syncState.status]);

  useEffect(() => {
    if (syncState.status === "loading" || typeof window === "undefined") return;
    if (window.localStorage.getItem(DASHBOARD_DISTRIBUTION_RESET_SEED_KEY)) return;
    window.localStorage.setItem(DASHBOARD_DISTRIBUTION_RESET_SEED_KEY, "1");
    setAdminLogs((previous) => {
      if ((previous || []).some((log) => log.id === "dashboard_change_20260724_distribution_reset")) return previous;
      const nextRevision = (previous || [])
        .filter((log) => log.type === DASHBOARD_CHANGE_NOTICE_TYPE)
        .reduce((highest, log) => Math.max(highest, Math.floor(dashboardRevisionOrder(log.revision))), 0) + 1;
      return normalizeAdminLogs([
        ...(previous || []),
        {
          id: "dashboard_change_20260724_distribution_reset",
          type: DASHBOARD_CHANGE_NOTICE_TYPE,
          projectName: "제품개발 대시보드",
          revision: String(nextRevision),
          changeDate: TODAY,
          changeDateTime: toDashboardDateTimeInput(),
          changes: [
            "유통 구조 설정에 전체 초기화 버튼을 추가했습니다.",
            "판매가·마진 설정과 경쟁제품 비교를 초기화한 뒤 유통 구조 미설정 상태로 되돌릴 수 있도록 개선했습니다."
          ],
          actor: "시스템",
          createdAt: new Date().toISOString()
        }
      ]);
    });
  }, [setAdminLogs, syncState.status]);

  useEffect(() => {
    if (syncState.status === "loading" || typeof window === "undefined") return;
    if (window.localStorage.getItem(DASHBOARD_SECURITY_HARDENING_SEED_KEY)) return;
    window.localStorage.setItem(DASHBOARD_SECURITY_HARDENING_SEED_KEY, "1");
    setAdminLogs((previous) => {
      if ((previous || []).some((log) => log.id === "dashboard_change_20260727_security_hardening")) return previous;
      const nextRevision = (previous || [])
        .filter((log) => log.type === DASHBOARD_CHANGE_NOTICE_TYPE)
        .reduce((highest, log) => Math.max(highest, Math.floor(dashboardRevisionOrder(log.revision))), 0) + 1;
      return normalizeAdminLogs([
        ...(previous || []),
        {
          id: "dashboard_change_20260727_security_hardening",
          type: DASHBOARD_CHANGE_NOTICE_TYPE,
          projectName: "제품개발 대시보드",
          revision: String(nextRevision),
          changeDate: TODAY,
          changeDateTime: toDashboardDateTimeInput(),
          changes: [
            "웹·PC용 시스템의 인증, API 요청, 첨부파일 및 백업 데이터 보안을 강화했습니다.",
            "로그인 반복 시도 차단, 외부 출처 변경 요청 차단, 보안 헤더와 요청 용량 제한을 적용했습니다.",
            "Next.js와 하위 패키지를 보안 패치 버전으로 업데이트했습니다."
          ],
          actor: "시스템",
          createdAt: new Date().toISOString()
        }
      ]);
    });
  }, [setAdminLogs, syncState.status]);

  useEffect(() => {
    if (syncState.status === "loading" || typeof window === "undefined") return;
    if (window.localStorage.getItem(DASHBOARD_MARKET_ANALYSIS_SEED_KEY)) return;
    window.localStorage.setItem(DASHBOARD_MARKET_ANALYSIS_SEED_KEY, "1");
    setAdminLogs((previous) => {
      if ((previous || []).some((log) => log.id === "dashboard_change_20260727_market_analysis")) return previous;
      const nextRevision = (previous || [])
        .filter((log) => log.type === DASHBOARD_CHANGE_NOTICE_TYPE)
        .reduce((highest, log) => Math.max(highest, Math.floor(dashboardRevisionOrder(log.revision))), 0) + 1;
      return normalizeAdminLogs([
        ...(previous || []),
        {
          id: "dashboard_change_20260727_market_analysis",
          type: DASHBOARD_CHANGE_NOTICE_TYPE,
          projectName: "제품개발 대시보드",
          revision: String(nextRevision),
          changeDate: TODAY,
          changeDateTime: toDashboardDateTimeInput(),
          changes: [
            "공급단가 품목과 연결되는 시장 규모 분석 탭을 추가했습니다.",
            "최근 5개년 생산·수입실적, 환율, 약국 점유율과 가맹약국 침투율 분석을 지원합니다.",
            "연간 소진수량, 필요 배치, 금융 기회비용과 공급단가 조정 기댓값을 자동 계산합니다."
          ],
          actor: "시스템",
          createdAt: new Date().toISOString()
        }
      ]);
    });
  }, [setAdminLogs, syncState.status]);

  useEffect(() => {
    if (syncState.status === "loading" || typeof window === "undefined") return;
    if (window.localStorage.getItem(DASHBOARD_MARKET_SEARCH_FIX_SEED_KEY)) return;
    window.localStorage.setItem(DASHBOARD_MARKET_SEARCH_FIX_SEED_KEY, "1");
    setAdminLogs((previous) => {
      if ((previous || []).some((log) => log.id === "dashboard_change_20260727_market_search_fix")) return previous;
      const nextRevision = (previous || [])
        .filter((log) => log.type === DASHBOARD_CHANGE_NOTICE_TYPE)
        .reduce((highest, log) => Math.max(highest, Math.floor(dashboardRevisionOrder(log.revision))), 0) + 1;
      return normalizeAdminLogs([
        ...(previous || []),
        {
          id: "dashboard_change_20260727_market_search_fix",
          type: DASHBOARD_CHANGE_NOTICE_TYPE,
          projectName: "제품개발 대시보드",
          revision: String(nextRevision),
          changeDate: TODAY,
          changeDateTime: toDashboardDateTimeInput(),
          changes: [
            "시장 규모 분석의 공급단가 건 검색 중 결과가 0건이 되어도 화면이 종료되지 않도록 수정했습니다.",
            "검색 결과가 없을 때 안내 화면을 표시하고, 다시 일치하는 검색어를 입력하면 품목 분석 화면이 복구됩니다."
          ],
          actor: "시스템",
          createdAt: new Date().toISOString()
        }
      ]);
    });
  }, [setAdminLogs, syncState.status]);

  useEffect(() => {
    if (syncState.status === "loading" || typeof window === "undefined") return;
    if (window.localStorage.getItem(DASHBOARD_SUPPLY_SCROLL_FIX_SEED_KEY)) return;
    window.localStorage.setItem(DASHBOARD_SUPPLY_SCROLL_FIX_SEED_KEY, "1");
    setAdminLogs((previous) => {
      if ((previous || []).some((log) => log.id === "dashboard_change_20260727_supply_scroll_fix")) return previous;
      const nextRevision = (previous || [])
        .filter((log) => log.type === DASHBOARD_CHANGE_NOTICE_TYPE)
        .reduce((highest, log) => Math.max(highest, Math.floor(dashboardRevisionOrder(log.revision))), 0) + 1;
      return normalizeAdminLogs([
        ...(previous || []),
        {
          id: "dashboard_change_20260727_supply_scroll_fix",
          type: DASHBOARD_CHANGE_NOTICE_TYPE,
          projectName: "제품개발 대시보드",
          revision: String(nextRevision),
          changeDate: TODAY,
          changeDateTime: toDashboardDateTimeInput(),
          changes: [
            "유통 구조에서 공급단가로 돌아온 뒤 신규 건을 추가할 때 목록이 기존 품목을 따라 움직이던 현상을 수정했습니다.",
            "연결 품목 위치 이동은 최초 진입 시 한 번만 적용되고 이후 입력·정렬 중에는 자동 스크롤하지 않습니다."
          ],
          actor: "시스템",
          createdAt: new Date().toISOString()
        }
      ]);
    });
  }, [setAdminLogs, syncState.status]);

  useEffect(() => {
    if (syncState.status === "loading" || typeof window === "undefined") return;
    if (window.localStorage.getItem(DASHBOARD_SUPPLY_DUPLICATE_SEED_KEY)) return;
    window.localStorage.setItem(DASHBOARD_SUPPLY_DUPLICATE_SEED_KEY, "1");
    setAdminLogs((previous) => {
      if ((previous || []).some((log) => log.id === "dashboard_change_20260727_supply_duplicate")) return previous;
      const nextRevision = (previous || [])
        .filter((log) => log.type === DASHBOARD_CHANGE_NOTICE_TYPE)
        .reduce((highest, log) => Math.max(highest, Math.floor(dashboardRevisionOrder(log.revision))), 0) + 1;
      return normalizeAdminLogs([
        ...(previous || []),
        {
          id: "dashboard_change_20260727_supply_duplicate",
          type: DASHBOARD_CHANGE_NOTICE_TYPE,
          projectName: "제품개발 대시보드",
          revision: String(nextRevision),
          changeDate: TODAY,
          changeDateTime: toDashboardDateTimeInput(),
          changes: [
            "저장된 공급단가 건을 복사해 새로운 입력 건으로 만드는 기능을 추가했습니다.",
            "복합 성분과 견적 정보는 유지하고 포장단위 등을 바로 수정할 수 있으며, 유통 구조와 시장 분석은 새 건으로 초기화됩니다."
          ],
          actor: "시스템",
          createdAt: new Date().toISOString()
        }
      ]);
    });
  }, [setAdminLogs, syncState.status]);

  useEffect(() => {
    if (syncState.status === "loading" || typeof window === "undefined") return;
    if (window.localStorage.getItem(DASHBOARD_MARKET_GROWTH_COST_SEED_KEY)) return;
    window.localStorage.setItem(DASHBOARD_MARKET_GROWTH_COST_SEED_KEY, "1");
    setAdminLogs((previous) => {
      if ((previous || []).some((log) => log.id === "dashboard_change_20260727_market_growth_cost")) return previous;
      const nextRevision = (previous || [])
        .filter((log) => log.type === DASHBOARD_CHANGE_NOTICE_TYPE)
        .reduce((highest, log) => Math.max(highest, Math.floor(dashboardRevisionOrder(log.revision))), 0) + 1;
      return normalizeAdminLogs([
        ...(previous || []),
        {
          id: "dashboard_change_20260727_market_growth_cost",
          type: DASHBOARD_CHANGE_NOTICE_TYPE,
          projectName: "제품개발 대시보드",
          revision: String(nextRevision),
          changeDate: TODAY,
          changeDateTime: toDashboardDateTimeInput(),
          changes: [
            "시장 규모 분석에서 5개년·3개년 연평균 성장률을 전환해 확인할 수 있도록 구분했습니다.",
            "조정 공급 원가를 직접 입력하고 공급수량, 배치 자금, 금융비용과 기대값 전체에 반영할 수 있습니다."
          ],
          actor: "시스템",
          createdAt: new Date().toISOString()
        }
      ]);
    });
  }, [setAdminLogs, syncState.status]);

  useEffect(() => {
    if (syncState.status === "loading" || typeof window === "undefined") return;
    if (window.localStorage.getItem(DASHBOARD_MARKET_DEFAULT_FORECAST_SEED_KEY)) return;
    window.localStorage.setItem(DASHBOARD_MARKET_DEFAULT_FORECAST_SEED_KEY, "1");
    setAdminLogs((previous) => {
      if ((previous || []).some((log) => log.id === "dashboard_change_20260727_market_defaults_forecast")) return previous;
      const nextRevision = (previous || [])
        .filter((log) => log.type === DASHBOARD_CHANGE_NOTICE_TYPE)
        .reduce((highest, log) => Math.max(highest, Math.floor(dashboardRevisionOrder(log.revision))), 0) + 1;
      return normalizeAdminLogs([
        ...(previous || []),
        {
          id: "dashboard_change_20260727_market_defaults_forecast",
          type: DASHBOARD_CHANGE_NOTICE_TYPE,
          projectName: "제품개발 대시보드",
          revision: String(nextRevision),
          changeDate: TODAY,
          changeDateTime: toDashboardDateTimeInput(),
          changes: [
            "시장 규모 분석 전역 기본값과 개별 품목 기본값 초기화·차이 확인 기능을 추가했습니다.",
            "참약사·제조사 판매가 조정률을 분리하고 최소 주문 배치 수를 소진기간·필요자금·금융비용에 반영했습니다.",
            "선택한 성장률에 따른 Year 1~3 예상 소진수량과 Year 1 YTD 전환 기능을 추가했습니다."
          ],
          actor: "시스템",
          createdAt: new Date().toISOString()
        }
      ]);
    });
  }, [setAdminLogs, syncState.status]);

  useEffect(() => {
    if (syncState.status === "loading" || typeof window === "undefined") return;
    if (window.localStorage.getItem(DASHBOARD_MARKET_GROWTH_YEAR_FILTER_SEED_KEY)) return;
    window.localStorage.setItem(DASHBOARD_MARKET_GROWTH_YEAR_FILTER_SEED_KEY, "1");
    setAdminLogs((previous) => {
      if ((previous || []).some((log) => log.id === "dashboard_change_20260727_market_growth_year_filter")) return previous;
      const nextRevision = (previous || [])
        .filter((log) => log.type === DASHBOARD_CHANGE_NOTICE_TYPE)
        .reduce((highest, log) => Math.max(highest, Math.floor(dashboardRevisionOrder(log.revision))), 0) + 1;
      return normalizeAdminLogs([
        ...(previous || []),
        {
          id: "dashboard_change_20260727_market_growth_year_filter",
          type: DASHBOARD_CHANGE_NOTICE_TYPE,
          projectName: "제품개발 대시보드",
          revision: String(nextRevision),
          changeDate: TODAY,
          changeDateTime: toDashboardDateTimeInput(),
          changes: [
            "시장 규모 분석에서 연도별 실적을 성장률 계산에 포함하거나 제외할 수 있도록 추가했습니다.",
            "불완전한 최근 연도를 제외하면 선택된 4개년과 포함된 최근 3개년 기준으로 성장률·수요 전망을 다시 계산합니다.",
            "Year 1을 YTD로 전환하면 일할 계산된 소진량을 기준으로 Year 2·3에도 선택한 성장률을 순차 적용합니다.",
            "시장 실적의 출처를 식품의약품안전처 의약품안전나라 공개 데이터로 명시했습니다."
          ],
          actor: "시스템",
          createdAt: new Date().toISOString()
        }
      ]);
    });
  }, [setAdminLogs, syncState.status]);

  useEffect(() => {
    if (syncState.status === "loading" || typeof window === "undefined") return;
    if (window.localStorage.getItem(DASHBOARD_MARKET_YTD_PRORATION_FIX_SEED_KEY)) return;
    window.localStorage.setItem(DASHBOARD_MARKET_YTD_PRORATION_FIX_SEED_KEY, "1");
    setAdminLogs((previous) => {
      if ((previous || []).some((log) => log.id === "dashboard_change_20260727_market_ytd_proration_fix")) return previous;
      const nextRevision = (previous || [])
        .filter((log) => log.type === DASHBOARD_CHANGE_NOTICE_TYPE)
        .reduce((highest, log) => Math.max(highest, Math.floor(dashboardRevisionOrder(log.revision))), 0) + 1;
      return normalizeAdminLogs([
        ...(previous || []),
        {
          id: "dashboard_change_20260727_market_ytd_proration_fix",
          type: DASHBOARD_CHANGE_NOTICE_TYPE,
          projectName: "제품개발 대시보드",
          revision: String(nextRevision),
          changeDate: TODAY,
          changeDateTime: toDashboardDateTimeInput(),
          changes: [
            "시장 규모 분석의 YTD 예상 소진량이 연간 물량 자체를 경과일 비율만큼 축소하던 계산 오류를 수정했습니다.",
            "YTD에서는 Year 1의 성장률 적용 기간만 현재 날짜 기준으로 일할 계산하고, Year 2·3은 각 연도 1월 1일부터 12월 31일까지의 연간 성장률로 계산합니다."
          ],
          actor: "시스템",
          createdAt: new Date().toISOString()
        }
      ]);
    });
  }, [setAdminLogs, syncState.status]);

  const addDashboardChange = ({ changeDateTime, revision, changes }) => {
    if (!isAdmin) {
      window.alert("변경사항 기록은 ADMIN만 추가할 수 있습니다.");
      return;
    }
    setAdminLogs((previous) => normalizeAdminLogs([
      ...(previous || []),
      {
        id: `dashboard_change_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: DASHBOARD_CHANGE_NOTICE_TYPE,
        projectName: "제품개발 대시보드",
        changeDate: String(changeDateTime || "").slice(0, 10),
        changeDateTime,
        revision,
        changes,
        reason: changes.join("\n"),
        actor: "ADMIN",
        createdAt: new Date().toISOString()
      }
    ]));
  };

  const updateDashboardChange = (entryId, { changeDateTime, revision, changes }) => {
    if (!isAdmin) {
      window.alert("변경사항 기록은 ADMIN만 수정할 수 있습니다.");
      return;
    }
    setAdminLogs((previous) => normalizeAdminLogs((previous || []).map((log) => (
      String(log.id) === String(entryId) && log.type === DASHBOARD_CHANGE_NOTICE_TYPE
        ? {
            ...log,
            changeDate: String(changeDateTime || "").slice(0, 10),
            changeDateTime,
            revision,
            changes,
            reason: changes.join("\n"),
            updatedAt: new Date().toISOString()
          }
        : log
    ))));
  };

  const deleteDashboardChange = (entryId) => {
    if (!isAdmin) {
      window.alert("변경사항 기록은 ADMIN만 삭제할 수 있습니다.");
      return;
    }
    setAdminLogs((previous) => normalizeAdminLogs((previous || []).filter((log) => (
      !(String(log.id) === String(entryId) && log.type === DASHBOARD_CHANGE_NOTICE_TYPE)
    ))));
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
    setModuleTab("development");
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

  const supplyCategoryCounts = useMemo(() => {
    const counts = Object.fromEntries(SUPPLY_PRICE_CATEGORIES.map((category) => [category.id, 0]));
    normalizeSupplyPriceItems(supplyPriceItems).forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, [supplyPriceItems]);

  const bucketOrder = Object.fromEntries(PROJECT_BUCKETS.map((bucket, index) => [bucket.id, index]));
  const getProjectBucketId = (project) => (
    project?.status === "completed" || project?.status === "on_hold" ? project.status : "in_progress"
  );

  const reorderProject = (projectId, targetStatus, targetProjectId = null, position = "before") => {
    setProjects((prev) => {
      const draggedId = String(projectId);
      const targetId = targetProjectId == null ? null : String(targetProjectId);
      const dragged = prev.find((project) => String(project.id) === draggedId);
      if (!dragged) return prev;
      if (targetId && draggedId === targetId) return prev;

      const nextProject = { ...dragged, status: targetStatus };
      const withoutDragged = prev.filter((project) => String(project.id) !== draggedId);
      const targetIndex = targetId
        ? withoutDragged.findIndex((project) => String(project.id) === targetId)
        : -1;

      if (targetIndex >= 0) {
        const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
        return normalizeProjects([
          ...withoutDragged.slice(0, insertIndex),
          nextProject,
          ...withoutDragged.slice(insertIndex)
        ]);
      }

      const lastSameBucketIndex = withoutDragged.reduce((lastIndex, project, index) => (
        getProjectBucketId(project) === targetStatus ? index : lastIndex
      ), -1);

      if (lastSameBucketIndex >= 0) {
        return normalizeProjects([
          ...withoutDragged.slice(0, lastSameBucketIndex + 1),
          nextProject,
          ...withoutDragged.slice(lastSameBucketIndex + 1)
        ]);
      }

      const targetOrder = bucketOrder[targetStatus] ?? 0;
      const firstLaterBucketIndex = withoutDragged.findIndex((project) => (
        (bucketOrder[getProjectBucketId(project)] ?? 0) > targetOrder
      ));

      if (firstLaterBucketIndex >= 0) {
        return normalizeProjects([
          ...withoutDragged.slice(0, firstLaterBucketIndex),
          nextProject,
          ...withoutDragged.slice(firstLaterBucketIndex)
        ]);
      }

      return normalizeProjects([...withoutDragged, nextProject]);
    });
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
      reason: `${task.name} 단계 점검 응답: Y`
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
          message: "지연 사유 확인 필요"
        }
      ]
    }));
    appendAdminLog({
      type: "stage_check_issue",
      projectId: project.id,
      projectName: project.name,
      reason: `${task.name} 단계 점검 응답: N (지연 적용 필요)`
    });
    openProject(project.id);
    setTab("tasks");
    setForcedEdit({ projectId: project.id, taskId: task.id, token: Date.now() });
  };

  const deleteProject = (projectId) => {
    if (!isAdmin) {
      window.alert("관리자(admin) 권한이 필요합니다.");
      return;
    }
    const target = projects.find((project) => project.id === projectId);
    if (!target) return;
    if (!window.confirm(`"${target.name}" 프로젝트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    const reason = window.prompt("삭제 사유를 입력해주세요.");
    if (reason === null) return;
    const reasonText = reason.trim();
    if (!reasonText) {
      window.alert("삭제 사유를 입력해야 프로젝트를 삭제할 수 있습니다.");
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
        actor: "관리자",
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

  const applyRestoredData = ({
    projects: nextProjects,
    adminLogs: nextAdminLogs,
    supplyPriceItems: nextSupplyPriceItems,
    marketAnalysisDefaults: nextMarketAnalysisDefaults,
    selectedId: nextSelectedId
  }) => {
    if (!isAdmin) return;
    if (Array.isArray(nextProjects)) {
      const normalizedProjects = normalizeProjects(nextProjects);
      setProjects(normalizedProjects);
      if (nextSelectedId) setSelectedId(nextSelectedId);
      else if (normalizedProjects.length > 0) setSelectedId(normalizedProjects[0].id);
      else setSelectedId(null);
    }
    if (Array.isArray(nextAdminLogs)) setAdminLogs(normalizeAdminLogs(nextAdminLogs));
    if (Array.isArray(nextSupplyPriceItems)) setSupplyPriceItems(normalizeSupplyPriceItems(nextSupplyPriceItems));
    if (nextMarketAnalysisDefaults && typeof nextMarketAnalysisDefaults === "object") {
      setMarketAnalysisDefaults(normalizeMarketAnalysisDefaults(nextMarketAnalysisDefaults));
    }
  };

  const updateSupplyPriceItem = (itemId, patch) => {
    setSupplyPriceItems((previousItems) => normalizeSupplyPriceItems(previousItems.map((item) => (
      String(item.id) === String(itemId)
        ? { ...item, ...patch, updatedAt: new Date().toISOString() }
        : item
    ))));
  };

  const openDistributionStructure = (itemId) => {
    const target = normalizeSupplyPriceItems(supplyPriceItems).find((item) => String(item.id) === String(itemId));
    if (target) setSupplyCategory(target.category);
    setFocusedSupplyItemId(null);
    setSelectedDistributionItemId(itemId);
    setModuleTab("distribution");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, left: 0 });
  };

  const openMarketSizeAnalysis = (itemId) => {
    const target = normalizeSupplyPriceItems(supplyPriceItems).find((item) => String(item.id) === String(itemId));
    if (target) setSupplyCategory(target.category);
    setFocusedSupplyItemId(null);
    setSelectedMarketItemId(itemId);
    setModuleTab("market");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, left: 0 });
  };

  const openSupplyPriceItem = (itemId) => {
    const target = normalizeSupplyPriceItems(supplyPriceItems).find((item) => String(item.id) === String(itemId));
    if (target) setSupplyCategory(target.category);
    setFocusedSupplyItemId(itemId);
    setModuleTab("supply");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f1f5f9",
      "--app-topbar-height": "72px",
      "--app-nav-bg": "#111827",
      "--app-nav-bg-strong": "#0f172a",
      "--app-nav-bg-soft": "#e2e8f0",
      "--app-nav-border": "rgba(148, 163, 184, .32)",
      "--app-nav-muted": "#94a3b8"
    }}>
      <div style={{
        height: "var(--app-topbar-height)",
        borderBottom: "1px solid rgba(148, 163, 184, .22)",
        background: "var(--app-nav-bg)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 18px",
        boxSizing: "border-box",
        position: "sticky",
        top: 0,
        zIndex: 20
      }}>
        <div style={{
          display: "inline-flex",
          gap: 8,
          padding: 6,
          borderRadius: 14,
          background: "rgba(255, 255, 255, .06)",
          border: "1px solid rgba(148, 163, 184, .24)",
          flex: "1 1 auto",
          minWidth: 0,
          overflowX: "auto"
        }}>
          {[
            ["home", "홈"],
            ["development", "제품개발"],
            ["supply", "공급단가"],
            ["distribution", "유통 구조 설정"],
            ["market", "시장 규모 분석"],
            ["transfer", "데이터 이전"]
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                setModuleTab(id);
                if (id === "home" || id === "development") {
                  setIsHome(true);
                  setTab("overview");
                  if (typeof window !== "undefined") {
                    const url = new URL(window.location.href);
                    url.searchParams.delete("project");
                    window.history.replaceState({}, "", url.toString());
                  }
                }
                if (typeof window !== "undefined") window.scrollTo({ top: 0, left: 0 });
              }}
              style={id === "home"
                ? homeModuleTabButtonStyle(moduleTab === id)
                : moduleTabButtonStyle(moduleTab === id)}
            >
              {label}
            </button>
          ))}
        </div>
        <DesktopProjectPathControl />
      </div>

      <div className="pms-body-layout" style={{ display: "flex", minHeight: "calc(100vh - var(--app-topbar-height))" }}>
        <ProjectSidebar
        isHome={isHome}
        setIsHome={setIsHome}
        setTab={setTab}
        moduleTab={moduleTab}
        setModuleTab={setModuleTab}
        isAdmin={isAdmin}
        goToNewProjectPage={goToNewProjectPage}
        goToProjectLogsPage={goToProjectLogsPage}
        groupedProjects={groupedProjects}
        projectBuckets={PROJECT_BUCKETS}
        supplyCategories={SUPPLY_PRICE_CATEGORIES}
        supplyCategory={supplyCategory}
        setSupplyCategory={setSupplyCategory}
        supplyCategoryCounts={supplyCategoryCounts}
        reorderProject={reorderProject}
        selectedId={selectedId}
        openProject={openProject}
        formatOwners={formatOwners}
        TODAY={TODAY}
      />

      <main className="pms-main-content" style={{ flex: 1, padding: 16, minWidth: 0, overflowX: "hidden" }}>
        {moduleTab === "home" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>홈</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>제품개발 시스템의 업데이트 및 변경사항을 확인합니다.</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <SyncBadge syncState={syncState} />
                <div style={{ fontSize: 11, fontWeight: 800, color: "#0f172a", background: "#e2e8f0", borderRadius: 999, padding: "3px 9px" }}>{roleLabel}</div>
                <button
                  onClick={handleLogout}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                >
                  로그아웃
                </button>
              </div>
            </div>
            <DashboardChangeLogSection
              entries={dashboardChangeLogs}
              isAdmin={isAdmin}
              onAdd={addDashboardChange}
              onUpdate={updateDashboardChange}
              onDelete={deleteDashboardChange}
            />
          </>
        ) : moduleTab === "supply" ? (
          <SupplyPriceTab
            items={supplyPriceItems}
            onItemsChange={setSupplyPriceItems}
            syncState={syncState}
            selectedCategory={supplyCategory}
            focusedItemId={focusedSupplyItemId}
            onOpenDistribution={openDistributionStructure}
            isAdmin={isAdmin}
          />
        ) : moduleTab === "distribution" ? (
          <DistributionStructureTab
            items={normalizeSupplyPriceItems(supplyPriceItems)}
            categories={SUPPLY_PRICE_CATEGORIES}
            selectedCategory={supplyCategory}
            selectedItemId={selectedDistributionItemId}
            onSelectedItemChange={setSelectedDistributionItemId}
            onUpdateItem={updateSupplyPriceItem}
            onOpenSupply={openSupplyPriceItem}
            onOpenMarket={openMarketSizeAnalysis}
            syncState={syncState}
          />
        ) : moduleTab === "market" ? (
          <MarketSizeAnalysisTab
            items={normalizeSupplyPriceItems(supplyPriceItems)}
            categories={SUPPLY_PRICE_CATEGORIES}
            selectedCategory={supplyCategory}
            selectedItemId={selectedMarketItemId}
            onSelectedItemChange={setSelectedMarketItemId}
            onUpdateItem={updateSupplyPriceItem}
            marketAnalysisDefaults={marketAnalysisDefaults}
            onMarketAnalysisDefaultsChange={(nextDefaults) => {
              setMarketAnalysisDefaults(normalizeMarketAnalysisDefaults(nextDefaults));
            }}
            onOpenSupply={openSupplyPriceItem}
            onOpenDistribution={openDistributionStructure}
            syncState={syncState}
          />
        ) : moduleTab === "transfer" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>데이터 이전</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>온라인과 오프라인 저장소 사이에서 전체 운영 데이터를 이동합니다.</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <SyncBadge syncState={syncState} />
                <div style={{ fontSize: 11, fontWeight: 800, color: "#0f172a", background: "#e2e8f0", borderRadius: 999, padding: "3px 9px" }}>{roleLabel}</div>
              </div>
            </div>
            <BackupTab
              projects={projects}
              adminLogs={adminLogs}
              supplyPriceItems={supplyPriceItems}
              marketAnalysisDefaults={marketAnalysisDefaults}
              isAdmin={isAdmin}
              onRestore={applyRestoredData}
            />
          </>
        ) : isHome ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>제품개발 대시보드</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>모든 제품개발 프로젝트의 현재 진행 상태를 한눈에 확인합니다.</div>
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
            <ProductDevelopmentDashboardTab
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
                프로젝트 삭제
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
                ["project_logs", "이력 로그"]
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
                onTaskStatusChange={(task, taskStatus) => {
                  if (!taskStatus || taskStatus === task.taskStatus) return;
                  updateProject(selectedProject.id, (project) => ({
                    ...project,
                    tasks: project.tasks.map((currentTask) => (
                      currentTask.id === task.id ? { ...currentTask, taskStatus } : currentTask
                    )),
                    changeLog: [
                      ...(project.changeLog || []),
                      {
                        id: Date.now(),
                        type: "task_status",
                        taskId: task.id,
                        taskName: task.name,
                        date: TODAY,
                        reason: `상태 변경: ${STATUS_LABEL[task.taskStatus] || task.taskStatus} -> ${STATUS_LABEL[taskStatus] || taskStatus}`
                      }
                    ]
                  }));
                  appendAdminLog({
                    type: "task_status_change",
                    projectId: selectedProject.id,
                    projectName: selectedProject.name,
                    reason: `${task.name} 상태 변경 (${STATUS_LABEL[task.taskStatus] || task.taskStatus} -> ${STATUS_LABEL[taskStatus] || taskStatus})`
                  });
                }}
                onScheduleCommit={({ tasks, start, developSubTimeline, changeCount, changes }) => {
                  const previousVersion = formatScheduleVersion(selectedProject.scheduleVersion);
                  const nextVersion = nextScheduleVersion(previousVersion, changeCount);
                  updateProject(selectedProject.id, (project) => {
                    const currentStatusById = Object.fromEntries((project.tasks || []).map((task) => [task.id, task.taskStatus]));
                    const committedTasks = tasks.map((task) => ({
                      ...task,
                      taskStatus: currentStatusById[task.id] || task.taskStatus
                    }));
                    const committedDevelopTask = committedTasks.find((task) => task.id === DEVELOP_TASK_ID);
                    const reason = changes.join(" / ");
                    const nextProject = {
                      ...project,
                      start: start || project.start,
                      tasks: committedTasks,
                      developSubTimeline: normalizeDevelopSubTimeline(developSubTimeline, committedDevelopTask?.duration || 1),
                      changeLog: [
                        ...(project.changeLog || []),
                        {
                          id: Date.now(),
                          type: "schedule_batch",
                          taskId: "_schedule_batch",
                          taskName: "태스크 일정/진행",
                          date: TODAY,
                          reason
                        }
                      ]
                    };
                    return withScheduleVersionUpdate(project, nextProject, {
                      changeCount,
                      reason: "태스크 관리 일괄 변경",
                      changes
                    });
                  });
                  appendAdminLog({
                    type: "schedule_version_change",
                    projectId: selectedProject.id,
                    projectName: selectedProject.name,
                    reason: `${previousVersion} -> ${nextVersion} · ${changes.join(" / ")}`
                  });
                }}
                onTaskSave={(task, patch) => {
                  const hasTaskNameChange = Boolean(patch.name && patch.name !== task.name);
                  const hasTaskIconChange = Boolean(patch.icon && patch.icon !== task.icon);
                  const hasTaskDateChange = Boolean(patch.startDate && patch.startDate !== task.scheduledStart);
                  const hasTaskEndDateChange = Boolean(patch.endDate && patch.endDate !== task.scheduledEnd);
                  const hasDelayChange = Boolean((patch.delayDays || 0) > 0);
                  const hasDurationChange = Boolean(typeof patch.duration === "number" && patch.duration !== task.duration);
                  const hasStatusChange = Boolean(patch.taskStatus && patch.taskStatus !== task.taskStatus);
                  const scheduleChanges = [
                    hasTaskNameChange ? `태스크명 변경: ${task.name} -> ${patch.name}` : "",
                    hasTaskIconChange ? `이모지 변경: ${task.icon || "-"} -> ${patch.icon}` : "",
                    hasTaskDateChange ? `시작일 조정: ${task.scheduledStart} -> ${patch.startDate}` : "",
                    hasTaskEndDateChange ? `완료일 조정: ${task.scheduledEnd} -> ${patch.endDate}` : "",
                    hasDurationChange ? `기간 변경: ${task.duration}일 -> ${patch.duration}일` : "",
                    hasDelayChange ? `지연 적용: +${patch.delayDays}일` : ""
                  ].filter(Boolean);
                  const hasScheduleChange = scheduleChanges.length > 0;
                  const previousVersion = formatScheduleVersion(selectedProject.scheduleVersion);
                  const nextVersion = hasScheduleChange
                    ? nextScheduleVersion(previousVersion, scheduleChanges.length)
                    : previousVersion;
                  updateProject(selectedProject.id, (project) => {
                    const tasks = project.tasks.map((currentTask) => {
                      if (currentTask.id !== task.id) return currentTask;

                      const hasStartPatch = Boolean(patch.startDate);
                      const hasEndPatch = Boolean(patch.endDate);
                      const hasDurationPatch = typeof patch.duration === "number";
                      const nextStart = hasStartPatch ? toStr(patch.startDate) : currentTask.scheduledStart;
                      let nextEnd = hasEndPatch ? toStr(patch.endDate) : currentTask.scheduledEnd;
                      let nextDuration = hasDurationPatch
                        ? toPositiveInt(patch.duration, currentTask.duration || 1)
                        : currentTask.duration;

                      if (hasDurationPatch && !hasEndPatch) {
                        nextEnd = toStr(addDays(nextStart, nextDuration));
                      }
                      if ((patch.delayDays || 0) > 0) {
                        nextEnd = toStr(addDays(nextEnd, patch.delayDays));
                      }

                      nextDuration = durationFromDates(nextStart, nextEnd, nextDuration);

                      return {
                        ...currentTask,
                        name: patch.name ?? currentTask.name,
                        icon: patch.icon ?? currentTask.icon,
                        progress: patch.progress ?? currentTask.progress,
                        taskStatus: (patch.delayDays || 0) > 0 ? "delayed" : (patch.taskStatus ?? currentTask.taskStatus),
                        notes: patch.notes ?? currentTask.notes,
                        vendorName: patch.vendorName ?? currentTask.vendorName,
                        duration: nextDuration,
                        scheduledStart: nextStart,
                        scheduledEnd: nextEnd
                      };
                    });

                    const developTask = tasks.find((currentTask) => currentTask.id === DEVELOP_TASK_ID);
                    const developSubTimeline = normalizeDevelopSubTimeline(
                      project.developSubTimeline,
                      developTask?.duration || 1
                    );
                    const changeSummary = [
                      ...scheduleChanges,
                      hasStatusChange
                        ? `상태 변경: ${STATUS_LABEL[task.taskStatus] || task.taskStatus} -> ${STATUS_LABEL[patch.taskStatus] || patch.taskStatus}`
                        : ""
                    ].filter(Boolean);
                    const nextProject = {
                      ...project,
                      tasks,
                      developSubTimeline,
                      changeLog: [
                        ...(project.changeLog || []),
                        {
                          id: Date.now(),
                          taskId: task.id,
                          taskName: patch.name ?? task.name,
                          date: TODAY,
                          reason:
                            patch.notes ||
                            (typeof patch.vendorName === "string"
                              ? `공급업체 기록: ${(task.vendorName || "-")} -> ${(patch.vendorName || "-")}`
                              : (changeSummary.join(" / ") || "수정")),
                          delayDays: patch.delayDays || 0,
                          duration: typeof patch.duration === "number" ? patch.duration : task.duration
                        }
                      ]
                    };
                    return hasScheduleChange
                      ? withScheduleVersionUpdate(project, nextProject, {
                        changeCount: scheduleChanges.length,
                        reason: `${patch.name ?? task.name} 일정 변경`,
                        changes: scheduleChanges
                      })
                      : nextProject;
                  });
                  if (hasScheduleChange || hasStatusChange) {
                    const reasonParts = [...scheduleChanges];
                    if (hasStatusChange) reasonParts.push(`상태: ${STATUS_LABEL[task.taskStatus] || task.taskStatus} -> ${STATUS_LABEL[patch.taskStatus] || patch.taskStatus}`);
                    appendAdminLog({
                      type: hasScheduleChange ? "schedule_version_change" : "task_status_change",
                      projectId: selectedProject.id,
                      projectName: selectedProject.name,
                      reason: hasScheduleChange
                        ? `${previousVersion} -> ${nextVersion} · ${task.name} (${reasonParts.join(" / ")})`
                        : `${task.name} 태스크 변경 (${reasonParts.join(" / ")})`
                    });
                  }
                }}
                onTaskAdd={({ name, cat, start, end }) => {
                  const taskId = `custom_${Date.now()}`;
                  const nextStart = toStr(start || selectedProject.start || TODAY);
                  const nextEnd = toStr(end || addDays(nextStart, 1));
                  const newTask = {
                    id: taskId,
                    name,
                    cat: cat || "기타",
                    icon: "📌",
                    color: CAT_COLORS[cat] || "#64748b",
                    duration: durationFromDates(nextStart, nextEnd, 1),
                    pred: [],
                    scheduledStart: nextStart,
                    scheduledEnd: nextEnd,
                    originalStart: nextStart,
                    originalEnd: nextEnd,
                    progress: 0,
                    isEnabled: true,
                    vendorName: "",
                    taskStatus: "pending",
                    notes: ""
                  };
                  const previousVersion = formatScheduleVersion(selectedProject.scheduleVersion);
                  const nextVersion = nextScheduleVersion(previousVersion, 1);
                  updateProject(selectedProject.id, (project) => {
                    const reason = `태스크 행 추가 (${fmt(nextStart)} ~ ${fmt(nextEnd)})`;
                    return withScheduleVersionUpdate(project, {
                      ...project,
                      tasks: [...project.tasks, newTask],
                      changeLog: [
                        ...(project.changeLog || []),
                        {
                          id: Date.now(),
                          type: "task_add",
                          taskId,
                          taskName: name,
                          date: TODAY,
                          reason
                        }
                      ]
                    }, {
                      changeCount: 1,
                      reason: `${name} 일정 추가`,
                      changes: [reason]
                    });
                  });
                  appendAdminLog({
                    type: "schedule_version_change",
                    projectId: selectedProject.id,
                    projectName: selectedProject.name,
                    reason: `${previousVersion} -> ${nextVersion} · ${name} 태스크 행 추가 (${nextStart} ~ ${nextEnd})`
                  });
                }}
                onTaskReorder={(orderedIds) => {
                  updateProject(selectedProject.id, (project) => {
                    const byId = Object.fromEntries((project.tasks || []).map((task) => [task.id, task]));
                    const orderedTasks = orderedIds.map((id) => byId[id]).filter(Boolean);
                    const missingTasks = (project.tasks || []).filter((task) => !orderedIds.includes(task.id));
                    const reason = "태스크 행 순서 변경";
                    return withScheduleVersionUpdate(project, {
                      ...project,
                      tasks: [...orderedTasks, ...missingTasks],
                      changeLog: [
                        ...(project.changeLog || []),
                        {
                          id: Date.now(),
                          type: "task_reorder",
                          taskId: "_task_reorder",
                          taskName: "태스크 순서",
                          date: TODAY,
                          reason
                        }
                      ]
                    }, {
                      changeCount: 1,
                      reason,
                      changes: [reason]
                    });
                  });
                  const previousVersion = formatScheduleVersion(selectedProject.scheduleVersion);
                  const nextVersion = nextScheduleVersion(previousVersion, 1);
                  appendAdminLog({
                    type: "schedule_version_change",
                    projectId: selectedProject.id,
                    projectName: selectedProject.name,
                    reason: `${previousVersion} -> ${nextVersion} · 태스크 행 순서 변경`
                  });
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
                    const reason = `프로젝트 시작일 변경 ${project.start} -> ${nextStart}`;
                    return withScheduleVersionUpdate(project, {
                      ...project,
                      start: nextStart,
                      changeLog: [
                        ...(project.changeLog || []),
                        {
                          id: Date.now(),
                          type: "project_start",
                          taskId: "_project_start",
                          taskName: "프로젝트 시작일",
                          date: TODAY,
                          reason
                        }
                      ]
                    }, {
                      changeCount: 1,
                      reason: "프로젝트 시작일 변경",
                      changes: [reason]
                    });
                  });
                  const previousVersion = formatScheduleVersion(selectedProject.scheduleVersion);
                  const nextVersion = nextScheduleVersion(previousVersion, 1);
                  appendAdminLog({
                    type: "schedule_version_change",
                    projectId: selectedProject.id,
                    projectName: selectedProject.name,
                    reason: `${previousVersion} -> ${nextVersion} · 프로젝트 시작일 변경 ${selectedProject.start} -> ${nextStart}`
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
                        taskName: "제품 개발 하단 타임라인",
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
                  const exists = (selectedProject.advisorLog || []).some((log) => String(log.id) === String(item.id));
                  updateProject(selectedProject.id, (project) => ({
                    ...project,
                    advisorLog: upsertById(project.advisorLog || [], item)
                  }));
                  appendAdminLog({
                    type: exists ? "advisor_log_update" : "advisor_log_add",
                    projectId: selectedProject.id,
                    projectName: selectedProject.name,
                    reason: `${item.name} 의견 ${exists ? "수정" : "등록"} (${item.datetime})`
                  });
                }}
              />
            )}

            {tab === "communication" && (
              <CommunicationTab
                project={selectedProject}
                onSaveLog={(item) => {
                  const exists = (selectedProject.communicationLog || []).some((log) => String(log.id) === String(item.id));
                  updateProject(selectedProject.id, (project) => ({
                    ...project,
                    communicationLog: upsertById(project.communicationLog || [], item)
                  }));
                  appendAdminLog({
                    type: exists ? "communication_log_update" : "communication_log_add",
                    projectId: selectedProject.id,
                    projectName: selectedProject.name,
                    reason: `${item.company} 소통 기록 ${exists ? "수정" : "등록"} (${item.date})`
                  });
                }}
              />
            )}

            {tab === "basic" && (
              <BasicInfoTab
                project={selectedProject}
                onSave={({ name, desc, pmName, amName, category, regulatoryDirection, exclusivityType, start, draftChecklist }) => {
                  const historyParts = [];
                  if (selectedProject.name !== name) historyParts.push(`프로젝트명 ${selectedProject.name} -> ${name}`);
                  if ((selectedProject.desc || "") !== desc) historyParts.push("기안 요약 수정");
                  if ((selectedProject.pmName || "") !== pmName) historyParts.push(`PM: ${selectedProject.pmName || "-"} -> ${pmName || "-"}`);
                  if ((selectedProject.amName || "") !== amName) historyParts.push(`AM: ${selectedProject.amName || "-"} -> ${amName || "-"}`);
                  if (selectedProject.category !== category) historyParts.push(`카테고리: ${selectedProject.category} -> ${category}`);
                  if ((selectedProject.regulatoryDirection || "") !== regulatoryDirection) historyParts.push(`허가/생산 방향성: ${selectedProject.regulatoryDirection || "-"} -> ${regulatoryDirection || "-"}`);
                  if ((selectedProject.exclusivityType || "") !== exclusivityType) historyParts.push(`독점 구분: ${selectedProject.exclusivityType || "-"} -> ${exclusivityType || "-"}`);
                  if (selectedProject.start !== start) historyParts.push(`시작일 ${selectedProject.start} -> ${start}`);
                  historyParts.push(...summarizeDraftChecklistChanges(selectedProject.draftChecklist, draftChecklist));
                  if (historyParts.length === 0) return;

                  updateProject(selectedProject.id, (project) => {
                    const historyParts = [];
                    if (project.name !== name) historyParts.push(`프로젝트명 ${project.name} -> ${name}`);
                    if ((project.desc || "") !== desc) historyParts.push("기안 요약 수정");
                    if ((project.pmName || "") !== pmName) historyParts.push(`PM: ${project.pmName || "-"} -> ${pmName || "-"}`);
                    if ((project.amName || "") !== amName) historyParts.push(`AM: ${project.amName || "-"} -> ${amName || "-"}`);
                    if (project.category !== category) historyParts.push(`카테고리: ${project.category} -> ${category}`);
                    if ((project.regulatoryDirection || "") !== regulatoryDirection) historyParts.push(`허가/생산 방향성: ${project.regulatoryDirection || "-"} -> ${regulatoryDirection || "-"}`);
                    if ((project.exclusivityType || "") !== exclusivityType) historyParts.push(`독점 구분: ${project.exclusivityType || "-"} -> ${exclusivityType || "-"}`);
                    if (project.start !== start) historyParts.push(`시작일 ${project.start} -> ${start}`);
                    historyParts.push(...summarizeDraftChecklistChanges(project.draftChecklist, draftChecklist));
                    if (historyParts.length === 0) return project;

                    const manager = [pmName, amName].filter(Boolean).join(" / ") || "미정";
                    return {
                      ...project,
                      name,
                      desc,
                      pmName,
                      amName,
                      manager,
                      category,
                      regulatoryDirection: isOtcEtcCategory(category) ? normalizeRegulatoryDirection(regulatoryDirection) : "",
                      exclusivityType: isOtcEtcCategory(category) ? normalizeExclusivityType(exclusivityType) : "",
                      start,
                      draftChecklist: normalizeDraftChecklist(draftChecklist),
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
                  const exists = (selectedProject.decisionLog || []).some((log) => String(log.id) === String(item.id));
                  updateProject(selectedProject.id, (project) => ({
                    ...project,
                    decisionLog: upsertById(project.decisionLog || [], item)
                  }));
                  appendAdminLog({
                    type: exists ? "decision_log_update" : "decision_log_add",
                    projectId: selectedProject.id,
                    projectName: selectedProject.name,
                    reason: `${item.decider} 결정 ${exists ? "수정" : "등록"}: ${item.title}`
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
      <style jsx global>{`
        @media (max-width: 720px) {
          .pms-body-layout {
            display: block !important;
            min-height: 0 !important;
          }
          .pms-project-sidebar {
            width: 100% !important;
            flex: none !important;
            height: auto !important;
            max-height: 210px !important;
            position: static !important;
            overflow: auto !important;
            padding: 10px !important;
          }
          .pms-main-content {
            padding: 10px !important;
          }
        }
      `}</style>
    </div>
  );
}





