export const MARKET_DECISION_OPTIONS = [
  { value: "", label: "미결정", color: "#64748b", borderColor: "#cbd5e1", background: "#f8fafc" },
  { value: "margin_insufficient", label: "마진 설정 부족", color: "#b45309", borderColor: "#fde68a", background: "#fffbeb" },
  { value: "market_insufficient", label: "시장 규모 미흡", color: "#b91c1c", borderColor: "#fecaca", background: "#fef2f2" },
  { value: "additional_review", label: "추가 검토", color: "#9a3412", borderColor: "#fed7aa", background: "#fff7ed" },
  { value: "proceed", label: "진행 추진", color: "#047857", borderColor: "#a7f3d0", background: "#ecfdf5" }
];

const MARKET_DECISION_ALIASES = {
  "": "",
  undecided: "",
  "미결정": "",
  proceed: "proceed",
  "진행": "proceed",
  "진행 추진": "proceed",
  margin_insufficient: "margin_insufficient",
  "마진 설정 부족": "margin_insufficient",
  market_insufficient: "market_insufficient",
  "시장 규모 미흡": "market_insufficient",
  review: "additional_review",
  additional_review: "additional_review",
  "추가검토": "additional_review",
  "추가 검토": "additional_review",
  stop: "market_insufficient",
  "중단": "market_insufficient"
};

export function normalizeMarketDecisionStatus(value) {
  return MARKET_DECISION_ALIASES[String(value ?? "").trim()] ?? "";
}

export function getMarketDecisionOption(value) {
  const normalized = normalizeMarketDecisionStatus(value);
  return MARKET_DECISION_OPTIONS.find((option) => option.value === normalized) || MARKET_DECISION_OPTIONS[0];
}

export function marketDecisionLabel(value) {
  return getMarketDecisionOption(value).label;
}

export function marketDecisionBadgeStyle(value) {
  const option = getMarketDecisionOption(value);
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 24,
    padding: "3px 8px",
    border: `1px solid ${option.borderColor}`,
    borderRadius: 5,
    background: option.background,
    color: option.color,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap"
  };
}
