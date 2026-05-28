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
  { id: "launch", name: "출시", cat: "출시", icon: "🚀", color: "#dc2626", duration: 1, pred: ["prep"] }
];

export const DEVELOP_SUB_TIMELINE_TEMPLATE = [
  { id: "dev_name", name: "제품명 선정", startOffset: 0, duration: 7 },
  { id: "dev_pack_unit", name: "포장 단위 선정", startOffset: 7, duration: 7 },
  { id: "dev_sensory", name: "관능도 테스트", startOffset: 14, duration: 10 },
  { id: "dev_design", name: "패키지 디자인", startOffset: 24, duration: 14 }
];

export function getDefaultDevelopSubTimeline() {
  return DEVELOP_SUB_TIMELINE_TEMPLATE.map((item) => ({ ...item }));
}

export function makeProject(id, name, desc, manager, category, startOffset, permitCompany = "", manufacturer = "") {
  const start = toStr(addDays(new Date(), startOffset));
  const tasks = PHASES.map((p) => ({ ...p, pred: [...p.pred] }));
  const schedule = calcSchedule(tasks, start);
  const progressMap = { idea: 100, research: 70, spec: 15 };
  const statusMap = { idea: "completed", research: "in_progress" };

  return {
    id,
    name,
    desc,
    manager,
    category,
    start,
    status: "in_progress",
    permitCompany,
    manufacturer,
    tasks: tasks.map((task) => ({
      ...task,
      scheduledStart: schedule[task.id].start,
      scheduledEnd: schedule[task.id].end,
      originalStart: schedule[task.id].start,
      originalEnd: schedule[task.id].end,
      progress: progressMap[task.id] || 0,
      taskStatus: statusMap[task.id] || "pending",
      notes: ""
    })),
    developSubTimeline: getDefaultDevelopSubTimeline(),
    communicationLog: [],
    decisionLog: [],
    contracts: [],
    changeLog: []
  };
}

export function getInitialProjects() {
  return [
    makeProject(
      1,
      "프리미엄 비타민C 1000mg",
      "약국 전용 고용량 비타민C 정제 개발",
      "김개발",
      "건강기능식품",
      -35,
      "(주)헬스파마코리아",
      "(주)건강제조파트너"
    ),
    makeProject(
      2,
      "장건강 프로바이오틱스",
      "복합 유산균 캡슐 약국 PB 제품",
      "이기획",
      "건강기능식품",
      -12,
      "(주)유한건강",
      "(주)바이오제조"
    ),
    makeProject(
      3,
      "눈건강 루테인 복합",
      "루테인+지아잔틴 눈건강 기능성 캡슐",
      "박출시",
      "건강기능식품",
      0
    )
  ];
}
