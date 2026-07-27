export const MODULE_BACKUP_SCHEMA = "pb_product_development_module_backup";
export const MODULE_BACKUP_SCHEMA_VERSION = 1;

export const MODULE_BACKUP_TYPES = {
  development: "제품개발",
  supply: "공급단가",
  distribution: "유통 구조 설정",
  market: "시장 규모 분석"
};

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertRecords(name, value) {
  if (!Array.isArray(value)) throw new Error(`${name} 배열이 없습니다.`);
  if (!value.every(isRecord)) throw new Error(`${name}에 올바르지 않은 항목이 포함되어 있습니다.`);
  return value;
}

function normalizedText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function supplyItemIdentityKey(item = {}) {
  const ingredients = (Array.isArray(item.ingredients) ? item.ingredients : [])
    .map((ingredient) => `${normalizedText(ingredient?.name)}:${normalizedText(ingredient?.content)}`)
    .filter((value) => value !== ":")
    .join("|");
  return [
    normalizedText(item.category),
    normalizedText(item.manufacturer),
    ingredients,
    normalizedText(item.packagingUnit),
    normalizedText(item.packagingForm),
    normalizedText(item.quantity),
    normalizedText(item.supplyUnitPrice),
    normalizedText(item.quoteDate)
  ].join("::");
}

function stripLinkedAnalyses(item = {}) {
  const copy = { ...item };
  delete copy.distributionStructure;
  delete copy.marketSizeAnalysis;
  return copy;
}

function distributionRecord(item = {}) {
  return {
    supplyItemId: item.id,
    identityKey: supplyItemIdentityKey(item),
    reference: {
      category: item.category,
      manufacturer: item.manufacturer,
      ingredients: item.ingredients,
      packagingUnit: item.packagingUnit,
      packagingForm: item.packagingForm,
      quantity: item.quantity,
      supplyUnitPrice: item.supplyUnitPrice,
      quoteDate: item.quoteDate
    },
    distributionStructure: isRecord(item.distributionStructure) ? item.distributionStructure : {}
  };
}

function marketRecord(item = {}) {
  return {
    supplyItemId: item.id,
    identityKey: supplyItemIdentityKey(item),
    reference: {
      category: item.category,
      manufacturer: item.manufacturer,
      ingredients: item.ingredients,
      packagingUnit: item.packagingUnit,
      packagingForm: item.packagingForm,
      quantity: item.quantity,
      supplyUnitPrice: item.supplyUnitPrice,
      quoteDate: item.quoteDate
    },
    marketSizeAnalysis: isRecord(item.marketSizeAnalysis) ? item.marketSizeAnalysis : {}
  };
}

export function createModuleBackup(moduleType, data = {}, metadata = {}) {
  if (!MODULE_BACKUP_TYPES[moduleType]) throw new Error("지원하지 않는 탭 백업 유형입니다.");

  let moduleData;
  if (moduleType === "development") {
    moduleData = {
      projects: Array.isArray(data.projects) ? data.projects : [],
      adminLogs: Array.isArray(data.adminLogs) ? data.adminLogs : []
    };
  } else if (moduleType === "supply") {
    moduleData = {
      supplyPriceItems: (Array.isArray(data.supplyPriceItems) ? data.supplyPriceItems : []).map(stripLinkedAnalyses)
    };
  } else if (moduleType === "distribution") {
    moduleData = {
      distributionItems: (Array.isArray(data.supplyPriceItems) ? data.supplyPriceItems : []).map(distributionRecord)
    };
  } else {
    moduleData = {
      marketItems: (Array.isArray(data.supplyPriceItems) ? data.supplyPriceItems : []).map(marketRecord)
    };
  }

  return {
    schema: MODULE_BACKUP_SCHEMA,
    schemaVersion: MODULE_BACKUP_SCHEMA_VERSION,
    moduleType,
    moduleLabel: MODULE_BACKUP_TYPES[moduleType],
    exportedAt: new Date().toISOString(),
    source: String(metadata.source || "unknown"),
    data: moduleData
  };
}

export function parseModuleBackup(value, expectedModuleType) {
  if (!isRecord(value) || value.schema !== MODULE_BACKUP_SCHEMA) {
    throw new Error("탭별 데이터 백업 파일 형식이 아닙니다.");
  }
  if (value.schemaVersion !== MODULE_BACKUP_SCHEMA_VERSION) {
    throw new Error(`지원하지 않는 탭 백업 버전입니다: ${String(value.schemaVersion || "없음")}`);
  }
  if (!MODULE_BACKUP_TYPES[value.moduleType]) throw new Error("백업 파일의 탭 유형이 올바르지 않습니다.");
  if (expectedModuleType && value.moduleType !== expectedModuleType) {
    throw new Error(`${MODULE_BACKUP_TYPES[expectedModuleType]} 복원에는 ${MODULE_BACKUP_TYPES[expectedModuleType]} 백업 파일을 선택해야 합니다.`);
  }
  if (!isRecord(value.data)) throw new Error("백업 데이터 본문이 올바르지 않습니다.");

  let data;
  let recordCount;
  if (value.moduleType === "development") {
    data = {
      projects: assertRecords("projects", value.data.projects),
      adminLogs: assertRecords("adminLogs", value.data.adminLogs)
    };
    recordCount = data.projects.length;
  } else if (value.moduleType === "supply") {
    data = { supplyPriceItems: assertRecords("supplyPriceItems", value.data.supplyPriceItems) };
    recordCount = data.supplyPriceItems.length;
  } else if (value.moduleType === "distribution") {
    data = { distributionItems: assertRecords("distributionItems", value.data.distributionItems) };
    recordCount = data.distributionItems.length;
  } else {
    data = { marketItems: assertRecords("marketItems", value.data.marketItems) };
    recordCount = data.marketItems.length;
  }

  return {
    moduleType: value.moduleType,
    moduleLabel: MODULE_BACKUP_TYPES[value.moduleType],
    exportedAt: String(value.exportedAt || ""),
    data,
    recordCount
  };
}
