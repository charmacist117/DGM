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
  return {
    projects: assertCollection("projects", value.projects),
    adminLogs: assertCollection("adminLogs", value.adminLogs),
    supplyPriceItems: assertCollection("supplyPriceItems", value.supplyPriceItems)
  };
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
      supplyPriceItems: Array.isArray(value.supplyPriceItems) ? value.supplyPriceItems : []
    });
    return { backup: value, data, summary: summarizeFullBackupData(data), legacy: true };
  }

  throw new Error("PB 제품개발 전체 백업 파일이 아닙니다.");
}
