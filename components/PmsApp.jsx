"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ProjectSidebar from "@/components/ProjectSidebar";
import {
  CATEGORIES,
  DRAFT_CHECKLIST_FIELDS,
  PHASES,
  PHASE_CATS,
  STATUS_COLOR,
  STATUS_LABEL,
  getDefaultDevelopSubTimeline,
  getInitialProjects,
  normalizeDraftChecklist
} from "@/lib/pms/defaults";
import { TODAY, addDays, diff, fmt, toStr } from "@/lib/pms/date";
import { calcSchedule } from "@/lib/pms/schedule";
import { downloadFile, projectFromBackupCsv, projectToBackupCsv, projectsToCsvBackupZip } from "@/lib/pms/exporters";

const LOCAL_CACHE_KEY = "pharmadev_pms_cache_v2";
const DEVELOP_TASK_ID = "develop";
const MERGED_SAMPLE_QUALITY_TASK_ID = "sample_quality";
const LEGACY_SAMPLE_TASK_ID = "sample";
const LEGACY_QUALITY_TASK_ID = "quality";
const ROLE_ADMIN = "admin";
const ROLE_GUEST = "guest";

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
  const phaseTaskById = Object.fromEntries(normalizedPhaseTasks.map((task) => [task.id, task]));
  const orderedPhaseTasks = sourceOrderIds
    .filter((id) => PHASE_ID_SET.has(id) && phaseTaskById[id])
    .map((id) => phaseTaskById[id]);
  const missingPhaseTasks = normalizedPhaseTasks.filter((task) => !sourceOrderIds.includes(task.id));
  const finalTasks = [...orderedPhaseTasks, ...missingPhaseTasks, ...extraTasks];

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

  return {
    ...projectCore,
    pmName: (project.pmName || "").trim(),
    amName: (project.amName || "").trim(),
    manager: project.manager || [project.pmName, project.amName].filter(Boolean).join(" / ") || "미정",
    category: project.category || "건강기능식품",
    start: startDate,
    tasks: finalOrderedTasks,
    developSubTimeline,
    communicationLog: Array.isArray(project.communicationLog) ? project.communicationLog : [],
    decisionLog: Array.isArray(project.decisionLog) ? project.decisionLog : [],
    advisorLog: Array.isArray(project.advisorLog) ? project.advisorLog : [],
    stageCheckLog: Array.isArray(project.stageCheckLog) ? project.stageCheckLog : [],
    changeLog: Array.isArray(project.changeLog) ? project.changeLog : [],
    draftChecklist: normalizeDraftChecklist(project.draftChecklist)
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
      actor: log.actor || "관리자",
      createdAt: log.createdAt || new Date().toISOString(),
      hiddenForManager: Boolean(log.hiddenForManager)
    }));
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
  if (typeof window === "undefined") return { projects: [], adminLogs: [], supplyPriceItems: [], hasData: false };
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
    return {
      projects,
      adminLogs,
      supplyPriceItems,
      hasData: projects.length > 0 || adminLogs.length > 0 || supplyPriceItems.length > 0
    };
  } catch {
    return { projects: [], adminLogs: [], supplyPriceItems: [], hasData: false };
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

function normalizeSupplyCheckedValue(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return ["1", "true", "yes", "y", "on"].includes(value.trim().toLowerCase());
  return false;
}

function normalizeSupplyIngredient(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    name: String(source.name || source.ingredientName || ""),
    content: String(source.content || source.ingredientContent || "")
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

function normalizeSupplyPriceItem(item = {}, fallbackId = Date.now()) {
  const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
  const id = source.id ?? fallbackId;
  return {
    id,
    category: normalizeSupplyCategory(source.category || source.supplyCategory || source.productCategory),
    manufacturer: String(source.manufacturer || ""),
    ingredients: normalizeSupplyIngredients(source),
    packagingUnit: String(source.packagingUnit || source.packageUnit || ""),
    packagingForm: String(source.packagingForm || source.packageForm || ""),
    quantity: String(source.quantity || source.supplyQuantity || source.qty || ""),
    minimumOrderBatchQuantity: String(
      source.minimumOrderBatchQuantity || source.minOrderBatchQuantity || source.minimumBatchQuantity || source.moq || ""
    ),
    dosage: String(source.dosage || ""),
    efficacy: String(source.efficacy || ""),
    supplyUnitPrice: String(source.supplyUnitPrice || ""),
    vatIncluded: normalizeSupplyCheckedValue(source.vatIncluded ?? source.includeVat ?? source.hasVat),
    permitCompanyFee: normalizeSupplyCheckedValue(
      source.permitCompanyFee ?? source.licenseCompanyFee ?? source.approvalCompanyFee ?? source.authorizationCompanyFee
    ),
    quoteDate: String(source.quoteDate || ""),
    memo: String(source.memo || ""),
    attachment: normalizeSupplyAttachment(source.attachment),
    createdAt: String(source.createdAt || new Date().toISOString()),
    updatedAt: String(source.updatedAt || "")
  };
}

function normalizeSupplyPriceItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && typeof item === "object")
    .map((item, index) => normalizeSupplyPriceItem(item, item.id ?? `supply_price_${index + 1}`));
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
          const serverIsEmpty = nextProjects.length === 0 && nextAdminLogs.length === 0 && nextSupplyPriceItems.length === 0;
          if (serverIsEmpty && localCache.hasData) {
            setProjects(localCache.projects);
            setAdminLogs(localCache.adminLogs);
            setSupplyPriceItems(localCache.supplyPriceItems);
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
      window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({ projects, adminLogs, supplyPriceItems, cachedAt: new Date().toISOString() }));
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
          body: JSON.stringify({ projects, adminLogs, supplyPriceItems })
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
  }, [projects, adminLogs, supplyPriceItems]);

  return { projects, setProjects, adminLogs, setAdminLogs, supplyPriceItems, setSupplyPriceItems, syncState };
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
        <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
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
  onTaskSave,
  onTaskAdd,
  onTaskReorder,
  onTaskToggle,
  onProjectStartChange,
  onDevelopSubTimelineUpdate,
  forcedEditTaskId,
  onForcedEditHandled
}) {
  const [editTask, setEditTask] = useState(null);
  const [projectStart, setProjectStart] = useState(project.start || TODAY);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({
    name: "",
    cat: "기타",
    start: project.start || TODAY,
    end: toStr(addDays(project.start || TODAY, 7))
  });
  const [draftTaskNames, setDraftTaskNames] = useState({});
  const [draftStartDates, setDraftStartDates] = useState({});
  const [draftEndDates, setDraftEndDates] = useState({});
  const [draftSupplierNames, setDraftSupplierNames] = useState({});
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const developTask = project.tasks.find((task) => task.id === DEVELOP_TASK_ID);
  const developDuration = toPositiveInt(developTask?.duration, 1);
  const developTimeline = developTask
    ? normalizeDevelopSubTimeline(project.developSubTimeline, developDuration)
    : [];

  useEffect(() => {
    setProjectStart(project.start || TODAY);
    setNewTask({
      name: "",
      cat: "기타",
      start: project.start || TODAY,
      end: toStr(addDays(project.start || TODAY, 7))
    });
    setShowAddTask(false);
  }, [project.id, project.start]);

  useEffect(() => {
    setDraftTaskNames(Object.fromEntries((project.tasks || []).map((task) => [task.id, task.name || ""])));
    setDraftStartDates(Object.fromEntries((project.tasks || []).map((task) => [task.id, task.scheduledStart || TODAY])));
    setDraftEndDates(Object.fromEntries((project.tasks || []).map((task) => [task.id, task.scheduledEnd || TODAY])));
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
  const toggleDevelopItem = (itemId) => {
    const raw = developTimeline.map((item) => (
      item.id === itemId ? { ...item, enabled: item.enabled === false ? true : false } : item
    ));
    onDevelopSubTimelineUpdate(normalizeDevelopSubTimeline(raw, developDuration));
  };

  const saveNewTask = () => {
    const name = newTask.name.trim();
    if (!name) {
      window.alert("태스크명을 입력해주세요.");
      return;
    }
    const start = newTask.start || project.start || TODAY;
    const end = newTask.end || toStr(addDays(start, 1));
    onTaskAdd({
      name,
      cat: newTask.cat || "기타",
      start,
      end
    });
    setNewTask({
      name: "",
      cat: "기타",
      start: project.start || TODAY,
      end: toStr(addDays(project.start || TODAY, 7))
    });
    setShowAddTask(false);
  };

  const moveTask = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    const ids = (project.tasks || []).map((task) => task.id);
    const fromIndex = ids.indexOf(fromId);
    const toIndex = ids.indexOf(toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextIds = [...ids];
    const [movedId] = nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, movedId);
    onTaskReorder(nextIds);
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>태스크 일정/진행 수정</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setShowAddTask((prev) => !prev)}
            style={{ padding: "6px 9px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
          >
            행 추가
          </button>
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>프로젝트 시작일</span>
          <input type="date" value={projectStart} onChange={(e) => setProjectStart(e.target.value)} style={{ ...inputStyle, width: 150, padding: "6px 8px", fontSize: 12 }} />
          <button
            onClick={() => onProjectStartChange(projectStart)}
            style={{ padding: "6px 9px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
          >
            적용
          </button>
        </div>
      </div>
      {showAddTask && (
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
          {project.tasks.flatMap((task) => {
            const enabled = task.isEnabled !== false;
            const isDragging = draggedTaskId === task.id;
            const isDragTarget = dragOverTaskId === task.id && draggedTaskId !== task.id;
            const rows = [
              <tr
                key={task.id}
                draggable
                onDragStart={(event) => {
                  setDraggedTaskId(task.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", task.id);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (dragOverTaskId !== task.id) setDragOverTaskId(task.id);
                }}
                onDragLeave={() => {
                  if (dragOverTaskId === task.id) setDragOverTaskId(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceId = event.dataTransfer.getData("text/plain") || draggedTaskId;
                  moveTask(sourceId, task.id);
                  setDraggedTaskId(null);
                  setDragOverTaskId(null);
                }}
                onDragEnd={() => {
                  setDraggedTaskId(null);
                  setDragOverTaskId(null);
                }}
                style={{
                  borderBottom: "1px solid #f1f5f9",
                  opacity: enabled ? (isDragging ? 0.45 : 1) : 0.55,
                  background: isDragTarget ? "#ecfeff" : "#fff"
                }}
              >
                <td style={{ padding: "9px 12px", fontSize: 12, color: "#64748b" }}>
                  <span
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
                      cursor: "grab",
                      userSelect: "none"
                    }}
                  >
                    ↕
                  </span>
                </td>
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
                <td style={{ padding: "9px 12px", fontSize: 13, fontWeight: 700 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 170 }}>
                    <span>{task.icon}</span>
                    <input
                      value={draftTaskNames[task.id] ?? task.name}
                      onChange={(event) => {
                        const next = event.target.value;
                        setDraftTaskNames((prev) => ({ ...prev, [task.id]: next }));
                      }}
                      onBlur={(event) => {
                        const next = event.target.value.trim();
                        if (next && next !== task.name) onTaskSave(task, { name: next });
                      }}
                      style={{ ...inputStyle, width: "100%", minWidth: 130, padding: "5px 8px", fontSize: 12, fontWeight: 700 }}
                      disabled={!enabled}
                    />
                  </div>
                </td>
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
                <td style={{ padding: "9px 12px", fontSize: 12 }}>
                  <input
                    type="date"
                    value={draftEndDates[task.id] || task.scheduledEnd}
                    onChange={(event) => {
                      const next = event.target.value;
                      setDraftEndDates((prev) => ({ ...prev, [task.id]: next }));
                    }}
                    onBlur={(event) => {
                      const next = event.target.value;
                      if (next && next !== task.scheduledEnd) onTaskSave(task, { endDate: next });
                    }}
                    style={{ ...inputStyle, width: 140, padding: "5px 8px", fontSize: 12 }}
                    disabled={!enabled}
                  />
                </td>
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
                      placeholder="예정 업체명 입력"
                      style={{ ...inputStyle, width: 180, padding: "5px 8px", fontSize: 12 }}
                      disabled={!enabled}
                    />
                  ) : (
                    <span style={{ color: "#94a3b8" }}>-</span>
                  )}
                </td>
                <td style={{ padding: "9px 12px", fontSize: 12 }}>
                  <select
                    value={task.taskStatus || "pending"}
                    onChange={(event) => onTaskSave(task, { taskStatus: event.target.value })}
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
                  <button onClick={() => setEditTask(task)} style={{ padding: "6px 9px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 12 }} disabled={!enabled}>
                    수정
                  </button>
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
                                <button
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
                                </button>
                              </div>
                              <input
                                type="number"
                                min={0}
                                value={item.startOffset}
                                onChange={(event) => saveDevelopItem(item.id, "startOffset", event.target.value)}
                                style={{ ...inputStyle, fontSize: 12, padding: "5px 8px" }}
                                title="시작 오프셋(일)"
                                disabled={!enabled}
                              />
                              <input
                                type="number"
                                min={1}
                                value={item.duration}
                                onChange={(event) => saveDevelopItem(item.id, "duration", event.target.value)}
                                style={{ ...inputStyle, fontSize: 12, padding: "5px 8px" }}
                                title="기간(일)"
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

function SupplyPriceTab({ items, onItemsChange, syncState, selectedCategory = "all" }) {
  const [search, setSearch] = useState("");
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [editingIds, setEditingIds] = useState(new Set());
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
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
  const monthRangeActive = Boolean(fromMonth || toMonth);
  const monthFilteredItems = useMemo(() => {
    if (!monthRangeActive) return categoryFilteredItems;
    return categoryFilteredItems.filter((item) => {
      const quoteMonth = getSupplyQuoteMonth(item.quoteDate);
      if (!quoteMonth) return false;
      if (fromMonth && quoteMonth < fromMonth) return false;
      if (toMonth && quoteMonth > toMonth) return false;
      return true;
    });
  }, [categoryFilteredItems, fromMonth, monthRangeActive, toMonth]);
  const query = useMemo(() => search.trim().toLowerCase(), [search]);
  const filteredItems = useMemo(() => {
    if (!query) return monthFilteredItems;
    return monthFilteredItems.filter((item) => (
      (item.ingredients || []).some((ingredient) => (
        ingredient.name.toLowerCase().includes(query)
      ))
    ));
  }, [monthFilteredItems, query]);

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

  const addItem = () => {
    const nextItem = normalizeSupplyPriceItem({
      ...createSupplyPriceItem(),
      category: currentCategory === "all" ? DEFAULT_SUPPLY_PRICE_CATEGORY : currentCategory
    });
    replaceItems([nextItem, ...safeItems]);
    setEditingIds((prev) => new Set([...prev, String(nextItem.id)]));
  };

  const deleteItem = (itemId) => {
    replaceItems(safeItems.filter((item) => String(item.id) !== String(itemId)));
    setEditingIds((prev) => {
      const next = new Set(prev);
      next.delete(String(itemId));
      return next;
    });
  };

  const requestDelete = (itemId) => {
    setDeleteTargetId(itemId);
    setDeleteConfirmText("");
  };

  const closeDeleteConfirm = () => {
    setDeleteTargetId(null);
    setDeleteConfirmText("");
  };

  const confirmDelete = () => {
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

  const saveItem = (itemId) => {
    const item = safeItems.find((candidate) => String(candidate.id) === String(itemId));
    if (!item) return;
    const hasIngredient = (item.ingredients || []).some((ingredient) => ingredient.name.trim());
    if (!item.manufacturer.trim() && !hasIngredient && !item.supplyUnitPrice.trim()) {
      window.alert("제조사, 성분명, 공급단가 중 하나 이상 입력해주세요.");
      return;
    }
    updateItem(itemId, {});
    setEditing(itemId, false);
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
          <SyncBadge syncState={syncState} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 360px) minmax(360px, 460px) auto 1fr", gap: 8, alignItems: "center" }}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="성분명 검색"
            style={{ ...inputStyle, fontSize: 15 }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, alignItems: "center" }}>
            <input
              type="month"
              value={fromMonth}
              max={toMonth || undefined}
              onChange={(event) => setFromMonth(event.target.value)}
              title="시작월"
              style={{ ...inputStyle, fontSize: 15 }}
            />
            <input
              type="month"
              value={toMonth}
              min={fromMonth || undefined}
              onChange={(event) => setToMonth(event.target.value)}
              title="종료월"
              style={{ ...inputStyle, fontSize: 15 }}
            />
            <button
              onClick={() => {
                setFromMonth("");
                setToMonth("");
              }}
              style={{ ...supplySubtleButtonStyle, padding: "8px 10px", whiteSpace: "nowrap" }}
            >
              전체월
            </button>
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
          const totalPrice = formatTotalPrice(item.supplyUnitPrice, item.quantity);
          const vatIncludedPrice = item.vatIncluded ? formatVatIncludedPrice(item.supplyUnitPrice) : "";
          const vatTotalPrice = item.vatIncluded ? formatTotalPrice(item.supplyUnitPrice, item.quantity, 1.1) : "";
          return (
            <div key={item.id} style={supplyCardStyle}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 1520, borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: 110 }} />
                    <col style={{ width: 150 }} />
                    <col style={{ width: 480 }} />
                    <col style={{ width: 210 }} />
                    <col style={{ width: 90 }} />
                    <col style={{ width: 230 }} />
                    <col style={{ width: 100 }} />
                  </colgroup>
                  <thead>
                    <tr style={supplyHeaderRowStyle}>
                      {["카테고리", "제조사", "공급 성분 / 함량 / 포장 / 수량 / 배치", "공급단가", "VAT 포함", "VAT 포함 가격", "관리"].map((header) => (
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
                          <select value={item.category} onChange={(event) => updateItem(item.id, { category: event.target.value })} style={supplyCompactInputStyle}>
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
                          <input value={item.manufacturer} onChange={(event) => updateItem(item.id, { manufacturer: event.target.value })} placeholder="제조사" style={supplyCompactInputStyle} />
                        ) : (
                          <div style={supplyTextCellStyle}>{item.manufacturer || "-"}</div>
                        )}
                      </td>
                      <td style={{ padding: 8 }}>
                        {isEditing ? (
                          <div style={{ display: "grid", gap: 6 }}>
                            {ingredients.map((ingredient, index) => (
                              <div key={`${item.id}_ingredient_${index}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, alignItems: "center" }}>
                                <input value={ingredient.name} onChange={(event) => updateIngredient(item.id, index, { name: event.target.value })} placeholder="성분명" style={supplyCompactInputStyle} />
                                <input value={ingredient.content} onChange={(event) => updateIngredient(item.id, index, { content: event.target.value })} placeholder="예: 500mg/정" style={supplyCompactInputStyle} />
                                <button onClick={() => removeIngredient(item.id, index)} style={{ ...supplySubtleButtonStyle, padding: "5px 7px", fontSize: 14 }}>삭제</button>
                              </div>
                            ))}
                            <button onClick={() => addIngredient(item.id)} style={{ ...supplySubtleButtonStyle, width: 128 }}>
                              + 성분 추가
                            </button>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, paddingTop: 4, borderTop: "1px dashed #e2e8f0" }}>
                              <input
                                value={item.packagingUnit}
                                onChange={(event) => updateItem(item.id, { packagingUnit: event.target.value })}
                                placeholder="포장단위"
                                style={supplyCompactInputStyle}
                              />
                              <input
                                value={item.packagingForm}
                                onChange={(event) => updateItem(item.id, { packagingForm: event.target.value })}
                                placeholder="포장형태"
                                style={supplyCompactInputStyle}
                              />
                              <input
                                value={item.quantity}
                                onChange={(event) => updateItem(item.id, { quantity: event.target.value })}
                                placeholder="수량"
                                style={supplyCompactInputStyle}
                              />
                            </div>
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
                        ) : (
                          <div style={{ display: "grid", gap: 4 }}>
                            {ingredients.some((ingredient) => ingredient.name || ingredient.content) ? ingredients.map((ingredient, index) => (
                              <div key={`${item.id}_ingredient_view_${index}`} style={supplyTextCellStyle}>
                                {ingredient.name || "-"}{ingredient.content ? ` / ${ingredient.content}` : ""}
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
                            <input value={item.supplyUnitPrice} onChange={(event) => updateItem(item.id, { supplyUnitPrice: event.target.value })} placeholder="예: 1,250원" style={supplyCompactInputStyle} />
                            <input
                              value={totalPrice}
                              readOnly
                              placeholder="총 금액"
                              style={{ ...supplyCompactInputStyle, background: "#f8fafc", color: totalPrice ? "#0f172a" : "#94a3b8", fontWeight: 800 }}
                            />
                          </div>
                        ) : (
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={supplyTextCellStyle}>{item.supplyUnitPrice || "-"}</div>
                            {totalPrice && (
                              <div style={supplyMoneyTextStyle}>
                                총 금액: {totalPrice}
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
                              placeholder="총 금액"
                              style={{ ...supplyCompactInputStyle, background: "#f8fafc", color: vatTotalPrice ? "#0f172a" : "#94a3b8", fontWeight: 800 }}
                            />
                          </div>
                        ) : item.vatIncluded ? (
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={supplyMoneyTextStyle}>
                              {vatIncludedPrice || "-"}
                            </div>
                            {vatTotalPrice && (
                              <div style={supplyMoneyTextStyle}>
                                총 금액: {vatTotalPrice}
                              </div>
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
                              <button onClick={() => requestDelete(item.id)} style={{ ...supplySubtleButtonStyle, borderColor: "#fecaca", color: "#dc2626" }}>
                                삭제
                              </button>
                            </>
                          ) : (
                            <button onClick={() => setEditing(item.id, true)} style={supplySubtleButtonStyle}>
                              수정
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ borderTop: "1px solid #cbd5e1", overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 1340, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={supplyDetailHeaderRowStyle}>
                      {["허가사 수수료", "견적일자", "용법용량", "효능효과", "첨부파일", "비고"].map((header) => (
                        <th key={header} style={{ textAlign: "left", padding: "9px 10px", fontSize: 14, color: "#3730a3", borderBottom: "1px solid #c7d2fe", whiteSpace: "nowrap" }}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ ...supplyDetailBodyRowStyle, verticalAlign: "top" }}>
                      <td style={{ padding: 8, width: 118 }}>
                        {isEditing ? (
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, color: "#334155", fontWeight: 700 }}>
                            <input
                              type="checkbox"
                              checked={Boolean(item.permitCompanyFee)}
                              onChange={(event) => updateItem(item.id, { permitCompanyFee: event.target.checked })}
                            />
                            해당
                          </label>
                        ) : (
                          <div style={supplyTextCellStyle}>{item.permitCompanyFee ? "해당" : "-"}</div>
                        )}
                      </td>
                      <td style={{ padding: 8, width: 130 }}>
                        {isEditing ? (
                          <input type="date" value={item.quoteDate} onChange={(event) => updateItem(item.id, { quoteDate: event.target.value })} style={supplyCompactInputStyle} />
                        ) : (
                          <div style={supplyTextCellStyle}>{item.quoteDate ? fmt(item.quoteDate) : "-"}</div>
                        )}
                      </td>
                      <td style={{ padding: 8, width: 220 }}>
                        {isEditing ? (
                          <textarea value={item.dosage} onChange={(event) => updateItem(item.id, { dosage: event.target.value })} placeholder="용법용량" style={supplyCompactTextareaStyle} />
                        ) : (
                          <div style={supplyTextCellStyle}>{item.dosage || "-"}</div>
                        )}
                      </td>
                      <td style={{ padding: 8, width: 220 }}>
                        {isEditing ? (
                          <textarea value={item.efficacy} onChange={(event) => updateItem(item.id, { efficacy: event.target.value })} placeholder="효능효과" style={supplyCompactTextareaStyle} />
                        ) : (
                          <div style={supplyTextCellStyle}>{item.efficacy || "-"}</div>
                        )}
                      </td>
                      <td style={{ padding: 8, width: 240 }}>
                        {isEditing && (
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,application/pdf"
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
                      <td style={{ padding: 8, width: 260 }}>
                        {isEditing ? (
                          <textarea value={item.memo} onChange={(event) => updateItem(item.id, { memo: event.target.value })} placeholder="비고" style={supplyCompactTextareaStyle} />
                        ) : (
                          <div style={supplyTextCellStyle}>{item.memo || "-"}</div>
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

      {deleteTargetId !== null && (
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
          <div style={{ fontSize: 12, color: "#64748b" }}>CSV는 백업/복원 탭에서 일괄 내보내기</div>
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
          <div style={{ fontSize: 12, color: "#64748b" }}>CSV는 백업/복원 탭에서 일괄 내보내기</div>
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

function BackupTab({ projects, adminLogs, supplyPriceItems, selectedProject, onRestore, isAdmin }) {
  const fileInputRef = useRef(null);
  const exportableAdminLogs = isAdmin
    ? adminLogs
    : (adminLogs || []).filter((log) => !log.hiddenForManager);

  const exportAllJson = () => {
    const content = JSON.stringify({ projects, adminLogs: exportableAdminLogs, supplyPriceItems }, null, 2);
    downloadFile(`Charmacist_PB_backup_${toStr(new Date())}.json`, content, "application/json");
  };

  const exportProjectCsv = () => {
    if (!selectedProject) return window.alert("선택된 프로젝트가 없습니다.");
    const csv = projectToBackupCsv(selectedProject, exportableAdminLogs);
    downloadFile(`${selectedProject.name}_project_backup.csv`, csv, "text/csv;charset=utf-8;");
  };

  const exportCsvWorkbook = () => {
    const zip = projectsToCsvBackupZip(projects);
    downloadFile(`Charmacist_PB_CSV_backup_${toStr(new Date())}.zip`, zip, "application/zip");
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>백업/복원</div>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 10 }}>
          서버 DB가 기본 저장소이며, JSON/CSV 파일 백업은 데이터 이전/복구용입니다.
        </div>
        <div style={{ fontSize: 12, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
          GitHub에 코드 파일을 업로드해도 의사결정/업체 소통 기록 같은 운영 데이터는 함께 업로드되지 않습니다.
          상단 저장 상태가 "로컬 캐시에만 저장됨"으로 보이면 Vercel/PostgreSQL 환경변수를 확인하고, 배포 전 JSON 백업을 내려받아 보관하세요.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={exportAllJson} style={primaryButton}>전체 JSON 백업</button>
          <button onClick={exportCsvWorkbook} style={subtleButton}>전체 프로젝트/체크리스트 CSV 묶음</button>
          <button onClick={exportProjectCsv} style={subtleButton}>현재 프로젝트 전체 CSV 백업</button>
          {isAdmin && <button onClick={() => fileInputRef.current?.click()} style={subtleButton}>JSON/CSV 백업파일 불러오기</button>}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
          CSV 묶음에는 전체 프로젝트 요약 CSV와 사전 체크리스트 CSV가 포함됩니다. 현재 프로젝트 전체 CSV 백업은 복원용 원장 데이터입니다.
        </div>
        {!isAdmin && <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>복원 기능은 admin 권한에서만 가능합니다.</div>}
      </div>
      {isAdmin && <input
        type="file"
        accept=".json,.csv,application/json,text/csv"
        style={{ display: "none" }}
        ref={fileInputRef}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            const text = await file.text();
            const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv");

            if (isCsv) {
              const restored = projectFromBackupCsv(text);
              const restoredProject = normalizeProject(restored.project);
              const restoredProjectId = String(restoredProject.id);
              const nextProjects = [
                ...projects.filter((project) => String(project.id) !== restoredProjectId),
                restoredProject
              ];
              const nextAdminLogs = [
                ...adminLogs.filter((log) => String(log?.projectId ?? "") !== restoredProjectId),
                ...normalizeAdminLogs(restored.adminLogs)
              ];
              onRestore({
                projects: normalizeProjects(nextProjects),
                adminLogs: normalizeAdminLogs(nextAdminLogs),
                selectedId: restoredProject.id
              });
              window.alert("CSV 프로젝트 백업 복원이 완료되었습니다.");
            } else {
              const parsed = JSON.parse(text);
              const nextProjects = Array.isArray(parsed)
                ? parsed
                : (Array.isArray(parsed?.projects) ? parsed.projects : null);
              if (!Array.isArray(nextProjects)) throw new Error("프로젝트 배열 형식이 아닙니다.");
              const nextAdminLogs = Array.isArray(parsed?.adminLogs) ? parsed.adminLogs : [];
              onRestore({
                projects: normalizeProjects(nextProjects),
                adminLogs: normalizeAdminLogs(nextAdminLogs),
                supplyPriceItems: normalizeSupplyPriceItems(Array.isArray(parsed?.supplyPriceItems) ? parsed.supplyPriceItems : supplyPriceItems)
              });
              window.alert("JSON 백업 데이터 복원이 완료되었습니다.");
            }
          } catch (error) {
            window.alert(`복원 실패: ${String(error.message || error)}`);
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
    desc: project.desc || "",
    pmName: project.pmName || "",
    amName: project.amName || "",
    category: project.category || CATEGORIES[0],
    start: project.start || TODAY,
    draftChecklist: normalizeDraftChecklist(project.draftChecklist)
  });
  const categoryOptions = CATEGORIES.includes(form.category) ? CATEGORIES : [form.category, ...CATEGORIES];

  useEffect(() => {
    setForm({
      name: project.name || "",
      desc: project.desc || "",
      pmName: project.pmName || "",
      amName: project.amName || "",
      category: project.category || CATEGORIES[0],
      start: project.start || TODAY,
      draftChecklist: normalizeDraftChecklist(project.draftChecklist)
    });
  }, [project.id, project.name, project.desc, project.pmName, project.amName, project.category, project.start, project.draftChecklist]);

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
          <div style={{ fontSize: 12, color: "#64748b" }}>CSV는 백업/복원 탭에서 일괄 내보내기</div>
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
        <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>홈 대시보드</div>
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
    syncState
  } = useProjectsStore();
  const [userRole, setUserRole] = useState(ROLE_GUEST);
  const [moduleTab, setModuleTab] = useState("development");
  const [supplyCategory, setSupplyCategory] = useState("all");
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
          border: "1px solid rgba(148, 163, 184, .24)"
        }}>
          {[
            ["development", "제품개발"],
            ["supply", "공급단가"]
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setModuleTab(id)}
              style={moduleTabButtonStyle(moduleTab === id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - var(--app-topbar-height))" }}>
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

      <main style={{ flex: 1, padding: 16, minWidth: 0 }}>
        {moduleTab === "supply" ? (
          <SupplyPriceTab
            items={supplyPriceItems}
            onItemsChange={setSupplyPriceItems}
            syncState={syncState}
            selectedCategory={supplyCategory}
          />
        ) : isHome ? (
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
                  const hasTaskNameChange = Boolean(patch.name && patch.name !== task.name);
                  const hasTaskDateChange = Boolean(patch.startDate && patch.startDate !== task.scheduledStart);
                  const hasTaskEndDateChange = Boolean(patch.endDate && patch.endDate !== task.scheduledEnd);
                  const hasDelayChange = Boolean((patch.delayDays || 0) > 0);
                  const hasDurationChange = Boolean(typeof patch.duration === "number" && patch.duration !== task.duration);
                  const hasStatusChange = Boolean(patch.taskStatus && patch.taskStatus !== task.taskStatus);
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
                              ? `공급업체 기록: ${(task.vendorName || "-")} -> ${(patch.vendorName || "-")}`
                              : ([
                                  patch.name && patch.name !== task.name ? `태스크명 변경: ${task.name} -> ${patch.name}` : "",
                                  patch.startDate ? `시작일 조정: ${task.scheduledStart} -> ${patch.startDate}` : "",
                                  patch.endDate ? `완료일 조정: ${task.scheduledEnd} -> ${patch.endDate}` : "",
                                  patch.taskStatus && patch.taskStatus !== task.taskStatus
                                    ? `상태 변경: ${STATUS_LABEL[task.taskStatus] || task.taskStatus} -> ${STATUS_LABEL[patch.taskStatus] || patch.taskStatus}`
                                    : ""
                                ].filter(Boolean).join(" / ") || "수정")),
                          delayDays: patch.delayDays || 0,
                          duration: typeof patch.duration === "number" ? patch.duration : task.duration
                        }
                      ]
                    };
                  });
                  if (hasTaskNameChange || hasTaskDateChange || hasTaskEndDateChange || hasDelayChange || hasDurationChange || hasStatusChange) {
                    const reasonParts = [];
                    if (hasTaskNameChange) reasonParts.push(`태스크명 ${task.name} -> ${patch.name}`);
                    if (hasTaskDateChange) reasonParts.push(`시작일 ${task.scheduledStart} -> ${patch.startDate}`);
                    if (hasTaskEndDateChange) reasonParts.push(`완료일 ${task.scheduledEnd} -> ${patch.endDate}`);
                    if (hasDelayChange) reasonParts.push(`지연 적용: +${patch.delayDays}일`);
                    if (hasDurationChange) reasonParts.push(`기간: ${task.duration}일 -> ${patch.duration}일`);
                    if (hasStatusChange) reasonParts.push(`상태: ${STATUS_LABEL[task.taskStatus] || task.taskStatus} -> ${STATUS_LABEL[patch.taskStatus] || patch.taskStatus}`);
                    appendAdminLog({
                      type: hasStatusChange && !hasTaskDateChange && !hasTaskEndDateChange && !hasDelayChange && !hasDurationChange
                        ? "task_status_change"
                        : "task_start_date_change",
                      projectId: selectedProject.id,
                      projectName: selectedProject.name,
                      reason: `${task.name} 태스크 변경 (${reasonParts.join(" / ")})`
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
                  updateProject(selectedProject.id, (project) => ({
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
                        reason: `태스크 행 추가 (${fmt(nextStart)} ~ ${fmt(nextEnd)})`
                      }
                    ]
                  }));
                  appendAdminLog({
                    type: "task_add",
                    projectId: selectedProject.id,
                    projectName: selectedProject.name,
                    reason: `${name} 태스크 행 추가 (${nextStart} ~ ${nextEnd})`
                  });
                }}
                onTaskReorder={(orderedIds) => {
                  updateProject(selectedProject.id, (project) => {
                    const byId = Object.fromEntries((project.tasks || []).map((task) => [task.id, task]));
                    const orderedTasks = orderedIds.map((id) => byId[id]).filter(Boolean);
                    const missingTasks = (project.tasks || []).filter((task) => !orderedIds.includes(task.id));
                    return {
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
                          reason: "태스크 행 순서 변경"
                        }
                      ]
                    };
                  });
                  appendAdminLog({
                    type: "task_reorder",
                    projectId: selectedProject.id,
                    projectName: selectedProject.name,
                    reason: "태스크 행 순서 변경"
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
                    return {
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
                          reason: `시작일 변경 ${project.start} -> ${nextStart}`
                        }
                      ]
                    };
                  });
                  appendAdminLog({
                    type: "project_start_date_change",
                    projectId: selectedProject.id,
                    projectName: selectedProject.name,
                    reason: `프로젝트 시작일 변경 ${selectedProject.start} -> ${nextStart}`
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
                onSave={({ name, desc, pmName, amName, category, start, draftChecklist }) => {
                  const historyParts = [];
                  if (selectedProject.name !== name) historyParts.push(`프로젝트명 ${selectedProject.name} -> ${name}`);
                  if ((selectedProject.desc || "") !== desc) historyParts.push("기안 요약 수정");
                  if ((selectedProject.pmName || "") !== pmName) historyParts.push(`PM: ${selectedProject.pmName || "-"} -> ${pmName || "-"}`);
                  if ((selectedProject.amName || "") !== amName) historyParts.push(`AM: ${selectedProject.amName || "-"} -> ${amName || "-"}`);
                  if (selectedProject.category !== category) historyParts.push(`카테고리: ${selectedProject.category} -> ${category}`);
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

            {tab === "backup" && (
              <BackupTab
                projects={projects}
                adminLogs={adminLogs}
                supplyPriceItems={supplyPriceItems}
                selectedProject={selectedProject}
                isAdmin={isAdmin}
                onRestore={({ projects: nextProjects, adminLogs: nextAdminLogs, supplyPriceItems: nextSupplyPriceItems, selectedId: nextSelectedId }) => {
                  if (!isAdmin) return;
                  setProjects(normalizeProjects(nextProjects));
                  setAdminLogs(normalizeAdminLogs(nextAdminLogs));
                  if (nextSupplyPriceItems) {
                    setSupplyPriceItems(normalizeSupplyPriceItems(nextSupplyPriceItems));
                  }
                  if (nextSelectedId) setSelectedId(nextSelectedId);
                  else if (nextProjects.length > 0) setSelectedId(nextProjects[0].id);
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
    </div>
  );
}





