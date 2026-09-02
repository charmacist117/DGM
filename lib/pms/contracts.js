export const CONTRACT_RECORD_TYPES = [
  { id: "parent", label: "모계약" },
  { id: "child", label: "하위 계약·문서" }
];

export const PARENT_CONTRACT_TYPES = [
  {
    id: "basic",
    label: "기본계약",
    description: "특정 상대방과 특정 사업·거래 관계의 기본 조건"
  },
  {
    id: "blanket",
    label: "포괄계약",
    description: "여러 품목·프로젝트 또는 반복 거래에 공통 적용되는 상위 조건"
  }
];

export const CHILD_CONTRACT_TYPES = [
  { id: "supplementary", label: "부대합의서" },
  { id: "purchase_order", label: "발주서" },
  { id: "product_terms", label: "품목별 조건합의서" },
  { id: "supply", label: "제품 공급계약" },
  { id: "manufacturing", label: "제조·생산계약" },
  { id: "license", label: "허가·라이선스계약" },
  { id: "distribution", label: "유통계약" },
  { id: "quality", label: "품질협약" },
  { id: "confidentiality", label: "비밀유지계약" },
  { id: "other", label: "기타 계약" }
];

export const CONTRACT_STATUSES = [
  { id: "draft", label: "작성중" },
  { id: "active", label: "유효" },
  { id: "renewal", label: "갱신 검토" },
  { id: "expired", label: "만료" },
  { id: "terminated", label: "해지" }
];

const recordTypeIds = new Set(CONTRACT_RECORD_TYPES.map((item) => item.id));
const parentTypeIds = new Set(PARENT_CONTRACT_TYPES.map((item) => item.id));
const childTypeIds = new Set(CHILD_CONTRACT_TYPES.map((item) => item.id));
const statusIds = new Set(CONTRACT_STATUSES.map((item) => item.id));

function text(value) {
  return String(value ?? "").trim();
}

function booleanValue(value) {
  return value === true || value === 1 || value === "1" || value === "true" || value === "yes";
}

export function normalizeContractRecord(value = {}, fallbackId = `contract_${Date.now()}`) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const recordType = recordTypeIds.has(source.recordType) ? source.recordType : "parent";
  const parentContractType = parentTypeIds.has(source.parentContractType) ? source.parentContractType : "basic";
  const childContractType = childTypeIds.has(source.childContractType) ? source.childContractType : "supply";
  const status = statusIds.has(source.status) ? source.status : "draft";

  return {
    id: text(source.id) || fallbackId,
    recordType,
    parentContractType: recordType === "parent" ? parentContractType : "",
    childContractType: recordType === "child" ? childContractType : "",
    parentId: recordType === "child" ? text(source.parentId) : "",
    title: text(source.title),
    contractNumber: text(source.contractNumber),
    counterparty: text(source.counterparty),
    projectId: recordType === "child" ? text(source.projectId) : "",
    supplyItemId: recordType === "child" ? text(source.supplyItemId) : "",
    signedDate: text(source.signedDate),
    effectiveDate: text(source.effectiveDate),
    expirationDate: text(source.expirationDate),
    status,
    autoRenewal: booleanValue(source.autoRenewal),
    renewalNoticeDays: text(source.renewalNoticeDays),
    contractAmount: text(source.contractAmount),
    paymentTerms: text(source.paymentTerms),
    nasPath: text(source.nasPath),
    keyTerms: text(source.keyTerms),
    memo: text(source.memo),
    createdAt: text(source.createdAt) || new Date().toISOString(),
    updatedAt: text(source.updatedAt)
  };
}

export function normalizeContractRecords(value = []) {
  return (Array.isArray(value) ? value : [])
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item, index) => normalizeContractRecord(item, `contract_${index + 1}`));
}

export function contractTypeLabel(record = {}) {
  if (record.recordType === "parent") {
    return PARENT_CONTRACT_TYPES.find((item) => item.id === record.parentContractType)?.label || "모계약";
  }
  return CHILD_CONTRACT_TYPES.find((item) => item.id === record.childContractType)?.label || "하위 계약·문서";
}

export function contractStatusLabel(value) {
  return CONTRACT_STATUSES.find((item) => item.id === value)?.label || "작성중";
}

export function createContractRecord(recordType = "parent", parentId = "") {
  return normalizeContractRecord({
    id: `contract_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    recordType,
    parentContractType: "basic",
    childContractType: "supply",
    parentId,
    status: "draft",
    renewalNoticeDays: "30",
    createdAt: new Date().toISOString()
  });
}
