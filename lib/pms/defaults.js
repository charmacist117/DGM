import { calcSchedule } from "@/lib/pms/schedule";
import { addDays, toStr } from "@/lib/pms/date";

export const CATEGORIES = ["ETC", "OTC", "건강기능식품", "식품", "화장품", "의약외품", "의료기기", "공산품"];
export const PHASE_CATS = ["기획", "계약", "개발", "출시", "인허가", "품질", "기타"];

export const STATUS_LABEL = {
  pending: "대기",
  in_progress: "진행중",
  completed: "완료",
  delayed: "지연",
  on_hold: "보류"
};

export const STATUS_COLOR = {
  pending: "#94a3b8",
  in_progress: "#3b82f6",
  completed: "#10b981",
  delayed: "#ef4444",
  on_hold: "#f59e0b"
};

export const PHASES = [
  { id: "idea", name: "아이디어 기획", cat: "기획", icon: "💡", color: "#7c3aed", duration: 14, pred: [] },
  { id: "research", name: "시장조사", cat: "기획", icon: "🔍", color: "#6d28d9", duration: 10, pred: ["idea"] },
  { id: "spec", name: "기획서 작성", cat: "기획", icon: "📋", color: "#5b21b6", duration: 7, pred: ["research"] },
  { id: "supplier", name: "공급업체 선정", cat: "계약", icon: "🏭", color: "#0369a1", duration: 14, pred: ["spec"] },
  { id: "negotiate", name: "계약 협상", cat: "계약", icon: "🤝", color: "#0284c7", duration: 14, pred: ["supplier"] },
  { id: "sign", name: "계약 체결", cat: "계약", icon: "✍️", color: "#0ea5e9", duration: 5, pred: ["negotiate"] },
  { id: "develop", name: "제품 개발", cat: "개발", icon: "⚗️", color: "#047857", duration: 45, pred: ["sign"] },
  { id: "sample_quality", name: "샘플 검수·품질 테스트", cat: "개발", icon: "🧪", color: "#10b981", duration: 28, pred: ["develop"] },
  { id: "marketing", name: "마케팅 준비", cat: "출시", icon: "📢", color: "#b45309", duration: 14, pred: ["sample_quality"] },
  { id: "prep", name: "출시 준비", cat: "출시", icon: "🎯", color: "#d97706", duration: 7, pred: ["marketing"] },
  { id: "stock_in", name: "제품 입고", cat: "출시", icon: "📦", color: "#f97316", duration: 5, pred: ["prep"] },
  { id: "launch", name: "출시", cat: "출시", icon: "🚀", color: "#dc2626", duration: 1, pred: ["stock_in"] }
];

export const DEVELOP_SUB_TIMELINE_TEMPLATE = [
  { id: "dev_name", name: "제품명 선정", startOffset: 0, duration: 7, enabled: true },
  { id: "dev_pack_unit", name: "포장 단위 선정", startOffset: 7, duration: 7, enabled: true },
  { id: "dev_sensory", name: "관능도 테스트", startOffset: 14, duration: 10, enabled: true },
  { id: "dev_design", name: "패키지 디자인", startOffset: 24, duration: 14, enabled: true }
];

export function getDefaultDevelopSubTimeline() {
  return DEVELOP_SUB_TIMELINE_TEMPLATE.map((item) => ({ ...item }));
}

export const DRAFT_CHECKLIST_FIELDS = [
  { key: "selectionProcess", label: "선정과정", placeholder: "제품/업체 선정 배경, 후보 비교, 선정 근거, 주요 리스크를 적어주세요." },
  { key: "salesProcess", label: "판매과정", placeholder: "판매 채널, 판매 담당, 예상 판매가, 판매 방식, 런칭 흐름을 적어주세요." },
  { key: "approvalDuration", label: "허가 및 신고 소요기간", placeholder: "허가/신고 유형, 필요 서류, 예상 소요기간, 선행 조건을 적어주세요." },
  { key: "expectedVolume", label: "예상물량", placeholder: "초도 물량, 월 예상 판매량, MOQ, 재고 운영 기준을 적어주세요." },
  { key: "productionMethod", label: "생산방식", placeholder: "OEM/ODM/위탁/자체 생산 여부, 제조사 후보, 포장 방식 등을 적어주세요." },
  { key: "draftMemo", label: "추가 기안 메모", placeholder: "검토가 필요한 쟁점, 승인 조건, 후속 확인사항을 자유롭게 적어주세요." }
];

export function createEmptyDraftChecklist() {
  return Object.fromEntries(DRAFT_CHECKLIST_FIELDS.map((field) => [field.key, ""]));
}

export function normalizeDraftChecklist(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    DRAFT_CHECKLIST_FIELDS.map((field) => [field.key, String(source[field.key] || "")])
  );
}

function buildDefaultTasks(startDate, progressMap = {}, statusMap = {}) {
  const tasks = PHASES.map((p) => ({ ...p, pred: [...p.pred] }));
  const schedule = calcSchedule(tasks, startDate);

  return tasks.map((task) => ({
    ...task,
    scheduledStart: schedule[task.id].start,
    scheduledEnd: schedule[task.id].end,
    originalStart: schedule[task.id].start,
    originalEnd: schedule[task.id].end,
    progress: progressMap[task.id] || 0,
    isEnabled: true,
    vendorName: "",
    taskStatus: statusMap[task.id] || "pending",
    notes: ""
  }));
}

export function createProjectFromForm({
  id,
  name,
  desc = "",
  pmName = "",
  amName = "",
  category,
  start,
  draftChecklist = {}
}) {
  const safeStart = toStr(start || new Date());
  const safePm = (pmName || "").trim();
  const safeAm = (amName || "").trim();
  const manager = [safePm, safeAm].filter(Boolean).join(" / ") || "미정";

  return {
    id,
    name: (name || "").trim(),
    desc: (desc || "").trim(),
    pmName: safePm,
    amName: safeAm,
    manager,
    category,
    start: safeStart,
    status: "in_progress",
    draftChecklist: normalizeDraftChecklist(draftChecklist),
    tasks: buildDefaultTasks(safeStart),
    developSubTimeline: getDefaultDevelopSubTimeline(),
    communicationLog: [],
    decisionLog: [],
    advisorLog: [],
    stageCheckLog: [],
    contracts: [],
    changeLog: [],
    scheduleVersion: "v1.00",
    scheduleVersionHistory: []
  };
}

export function makeProject(id, name, desc, manager, category, startOffset) {
  const start = toStr(addDays(new Date(), startOffset));
  const progressMap = { idea: 100, research: 70, spec: 15 };
  const statusMap = { idea: "completed", research: "in_progress" };

  return {
    id,
    name,
    desc,
    pmName: manager || "",
    amName: "",
    manager,
    category,
    start,
    status: "in_progress",
    draftChecklist: createEmptyDraftChecklist(),
    tasks: buildDefaultTasks(start, progressMap, statusMap),
    developSubTimeline: getDefaultDevelopSubTimeline(),
    communicationLog: [],
    decisionLog: [],
    advisorLog: [],
    stageCheckLog: [],
    contracts: [],
    changeLog: [],
    scheduleVersion: "v1.00",
    scheduleVersionHistory: []
  };
}

export function getInitialProjects() {
  return [];
}
