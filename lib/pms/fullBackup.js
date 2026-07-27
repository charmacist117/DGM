import { normalizeMarketAnalysisDefaults } from "@/lib/pms/marketAnalysis";

export const FULL_BACKUP_SCHEMA = "pb_product_development_full_backup";
export const FULL_BACKUP_SCHEMA_VERSION = 1;

const MAX_RECORDS_PER_COLLECTION = 100000;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  "pdf", "png", "jpg", "jpeg", "webp", "doc", "docx", "xls", "xlsx", "csv", "txt"
]);
const ALLOWED_ATTACHMENT_TYPES = new Set([
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

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertCollection(name, value) {
  if (!Array.isArray(value)) throw new Error(`${name} 배열이 없습니다.`);
  if (value.length > MAX_RECORDS_PER_COLLECTION) throw new Error(`${name} 건수가 허용 범위를 초과했습니다.`);
  if (!value.every(isRecord)) throw new Error(`${name}에 올바르지 않은 항목이 포함되어 있습니다.`);
  return value;
}

function estimatedBase64Bytes(encoded) {
  const value = String(encoded || "").replace(/\s/g, "");
  const padding = value.endsWith("==") ? 2 : (value.endsWith("=") ? 1 : 0);
  return Math.max(0, Math.floor((value.length * 3) / 4) - padding);
}

function validateAttachment(attachment, itemIndex) {
  if (attachment === null || attachment === undefined) return 0;
  if (!isRecord(attachment)) throw new Error(`공급단가 ${itemIndex + 1}번의 첨부파일 정보가 올바르지 않습니다.`);

  const name = String(attachment.name || "").trim();
  const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  const declaredType = String(attachment.type || "").toLowerCase();
  const dataUrl = String(attachment.dataUrl || "");
  if (!name || name.length > 255 || /[\\/\0\r\n]/.test(name)) {
    throw new Error(`공급단가 ${itemIndex + 1}번의 첨부파일 이름이 올바르지 않습니다.`);
  }
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension) || !ALLOWED_ATTACHMENT_TYPES.has(declaredType)) {
    throw new Error(`공급단가 ${itemIndex + 1}번의 첨부파일 형식은 허용되지 않습니다.`);
  }
  if (!dataUrl) return 0;

  const match = /^data:([^;,]*);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) throw new Error(`공급단가 ${itemIndex + 1}번의 첨부파일 데이터가 올바르지 않습니다.`);
  const embeddedType = String(match[1] || "").toLowerCase();
  if (!ALLOWED_ATTACHMENT_TYPES.has(embeddedType)) {
    throw new Error(`공급단가 ${itemIndex + 1}번의 첨부파일 형식은 허용되지 않습니다.`);
  }

  const bytes = estimatedBase64Bytes(match[2]);
  const declaredSize = Number(attachment.size || bytes);
  if (!Number.isFinite(declaredSize) || declaredSize < 0 || bytes > MAX_ATTACHMENT_BYTES || declaredSize > MAX_ATTACHMENT_BYTES) {
    throw new Error(`공급단가 ${itemIndex + 1}번의 첨부파일은 10MB를 초과할 수 없습니다.`);
  }
  return bytes;
}

function validateAttachments(supplyPriceItems) {
  const totalBytes = supplyPriceItems.reduce(
    (total, item, index) => total + validateAttachment(item?.attachment, index),
    0
  );
  if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
    throw new Error("첨부파일 전체 용량은 20MB를 초과할 수 없습니다.");
  }
}

function attachmentStats(supplyPriceItems) {
  return supplyPriceItems.reduce((stats, item) => {
    const dataUrl = String(item?.attachment?.dataUrl || "");
    if (!dataUrl) return stats;
    const encoded = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
    return {
      count: stats.count + 1,
      bytes: stats.bytes + Math.max(0, Math.floor((encoded.length * 3) / 4))
    };
  }, { count: 0, bytes: 0 });
}

export function summarizeFullBackupData(data) {
  const attachments = attachmentStats(data.supplyPriceItems);
  return {
    projectCount: data.projects.length,
    adminLogCount: data.adminLogs.length,
    supplyPriceItemCount: data.supplyPriceItems.length,
    includesMarketAnalysisDefaults: Boolean(data.marketAnalysisDefaults),
    attachmentCount: attachments.count,
    attachmentBytes: attachments.bytes
  };
}

export function createFullBackup(data, metadata = {}) {
  const validated = validateFullBackupData(data);
  return {
    schema: FULL_BACKUP_SCHEMA,
    schemaVersion: FULL_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    source: String(metadata.source || "unknown"),
    includesEmbeddedAttachments: true,
    summary: summarizeFullBackupData(validated),
    data: validated
  };
}

export function validateFullBackupData(value) {
  if (!isRecord(value)) throw new Error("백업 데이터 본문이 올바르지 않습니다.");
  const projects = assertCollection("projects", value.projects);
  const adminLogs = assertCollection("adminLogs", value.adminLogs);
  const supplyPriceItems = assertCollection("supplyPriceItems", value.supplyPriceItems);
  const marketAnalysisDefaults = normalizeMarketAnalysisDefaults(value.marketAnalysisDefaults);
  validateAttachments(supplyPriceItems);
  return { projects, adminLogs, supplyPriceItems, marketAnalysisDefaults };
}

export function parseFullBackup(value, { allowLegacy = true } = {}) {
  if (!isRecord(value)) throw new Error("JSON 백업 파일 형식이 올바르지 않습니다.");

  if (value.schema === FULL_BACKUP_SCHEMA) {
    if (value.schemaVersion !== FULL_BACKUP_SCHEMA_VERSION) {
      throw new Error(`지원하지 않는 백업 버전입니다: ${String(value.schemaVersion || "없음")}`);
    }
    const data = validateFullBackupData(value.data);
    return { backup: value, data, summary: summarizeFullBackupData(data), legacy: false };
  }

  if (allowLegacy && Array.isArray(value.projects)) {
    const data = validateFullBackupData({
      projects: value.projects,
      adminLogs: Array.isArray(value.adminLogs) ? value.adminLogs : [],
      supplyPriceItems: Array.isArray(value.supplyPriceItems) ? value.supplyPriceItems : [],
      marketAnalysisDefaults: value.marketAnalysisDefaults
    });
    return { backup: value, data, summary: summarizeFullBackupData(data), legacy: true };
  }

  throw new Error("PB 제품개발 전체 백업 파일이 아닙니다.");
}
