export const MARKET_DECISION_OPTIONS = [
  { value: "", label: "미결정", color: "#64748b", borderColor: "#cbd5e1", background: "#f8fafc" },
  { value: "proceed", label: "진행", color: "#047857", borderColor: "#a7f3d0", background: "#ecfdf5" },
  { value: "review", label: "추가검토", color: "#b45309", borderColor: "#fde68a", background: "#fffbeb" },
  { value: "stop", label: "중단", color: "#b91c1c", borderColor: "#fecaca", background: "#fef2f2" }
];

const MARKET_DECISION_ALIASES = {
  "": "",
  undecided: "",
  "미결정": "",
  proceed: "proceed",
  "진행": "proceed",
  review: "review",
  "추가검토": "review",
  stop: "stop",
  "중단": "stop"
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
