function compactValue(value) {
  if (value === null || value === undefined || value === "") return undefined;
  if (Array.isArray(value)) {
    const items = value.map(compactValue).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, compactValue(item)])
      .filter(([, item]) => item !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  return value;
}

export function compactStorageValue(value, fallback = {}) {
  return compactValue(value) ?? fallback;
}

export function createCompactPmsPayload({
  projects = [],
  adminLogs = [],
  supplyPriceItems = [],
  contractRecords = [],
  marketAnalysisDefaults = {}
} = {}) {
  const compactCollection = (items) => (Array.isArray(items) ? items : [])
    .map((item) => compactStorageValue(item, {}));
  return {
    projects: compactCollection(projects),
    adminLogs: compactCollection(adminLogs),
    supplyPriceItems: compactCollection(supplyPriceItems),
    contractRecords: compactCollection(contractRecords),
    marketAnalysisDefaults: compactStorageValue(marketAnalysisDefaults, {})
  };
}
