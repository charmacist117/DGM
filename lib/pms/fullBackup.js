import { normalizeMarketAnalysisDefaults } from "@/lib/pms/marketAnalysis";

export const FULL_BACKUP_SCHEMA = "pb_product_development_full_backup";
export const FULL_BACKUP_SCHEMA_VERSION = 1;

const MAX_RECORDS_PER_COLLECTION = 100000;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertCollection(name, value) {
  if (!Array.isArray(value)) throw new Error(`${name} 배열이 없습니다.`);
  if (value.length > MAX_RECORDS_PER_COLLECTION) throw new Error(`${name} 건수가 허용 범위를 초과했습니다.`);
  if (!value.every(isRecord)) throw new Error(`${name}에 올바르지 않은 항목이 포함되어 있습니다.`);
  return value;
}

function stripAttachments(items) {
  return items.map((item) => {
    const copy = { ...item };
    delete copy.attachment;
    return copy;
  });
}

export function summarizeFullBackupData(data) {
  return {
    projectCount: data.projects.length,
    adminLogCount: data.adminLogs.length,
    supplyPriceItemCount: data.supplyPriceItems.length,
    includesMarketAnalysisDefaults: Boolean(data.marketAnalysisDefaults)
  };
}

export function createFullBackup(data, metadata = {}) {
  const validated = validateFullBackupData(data);
  return {
    schema: FULL_BACKUP_SCHEMA,
    schemaVersion: FULL_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    source: String(metadata.source || "unknown"),
    includesEmbeddedAttachments: false,
    summary: summarizeFullBackupData(validated),
    data: validated
  };
}

export function validateFullBackupData(value) {
  if (!isRecord(value)) throw new Error("백업 데이터 본문이 올바르지 않습니다.");
  const projects = assertCollection("projects", value.projects);
  const adminLogs = assertCollection("adminLogs", value.adminLogs);
  const supplyPriceItems = stripAttachments(assertCollection("supplyPriceItems", value.supplyPriceItems));
  const marketAnalysisDefaults = normalizeMarketAnalysisDefaults(value.marketAnalysisDefaults);
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
