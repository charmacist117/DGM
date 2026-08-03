export const SUPPLY_COST_TYPE_OPTIONS = [
  "원재료비",
  "부자재비",
  "부재료비",
  "가공비",
  "노무비",
  "제조비",
  "일반경비",
  "기업이윤",
  "기타"
];

function costNumber(value) {
  const cleaned = String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function supportsSupplyCostBreakdown(category) {
  return String(category || "").trim().toUpperCase() !== "OTC";
}

export function normalizeSupplyCostItem(value = {}, fallbackId = "cost_item_1") {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const rawType = String(source.type || source.category || source.costType || "부자재비").trim();
  return {
    id: source.id ?? fallbackId,
    type: SUPPLY_COST_TYPE_OPTIONS.includes(rawType) ? rawType : "기타",
    detail: String(source.detail || source.name || source.itemName || ""),
    amount: String(source.amount ?? source.batchAmount ?? source.totalAmount ?? ""),
    memo: String(source.memo || source.note || "")
  };
}

export function normalizeSupplyCostBreakdown(value = []) {
  return (Array.isArray(value) ? value : [])
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item, index) => normalizeSupplyCostItem(item, `cost_item_${index + 1}`));
}

export function supplyCostBreakdownTotal(value = []) {
  return normalizeSupplyCostBreakdown(value).reduce((total, item) => {
    const amount = costNumber(item.amount);
    return total + (amount === null ? 0 : amount);
  }, 0);
}

export function supplyCostBreakdownPerPackage(value = [], quantity) {
  const count = costNumber(quantity);
  if (count === null || count <= 0) return null;
  return supplyCostBreakdownTotal(value) / count;
}

export function supplyCostBreakdownCsvText(value = []) {
  return normalizeSupplyCostBreakdown(value)
    .filter((item) => item.detail.trim() || item.amount.trim() || item.memo.trim())
    .map((item) => {
      const detail = item.detail.trim() ? ` - ${item.detail.trim()}` : "";
      const rawAmount = item.amount.trim();
      const numericAmount = costNumber(rawAmount);
      const amount = rawAmount
        ? `: ${numericAmount === null ? rawAmount : `${numericAmount.toLocaleString("ko-KR")}원`}`
        : "";
      const memo = item.memo.trim() ? ` (${item.memo.trim()})` : "";
      return `${item.type}${detail}${amount}${memo}`;
    })
    .join(" | ");
}
