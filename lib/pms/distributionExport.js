export const DISTRIBUTION_EXPORT_SECTION_KEYS = ["profile", "pricing", "comparison"];

export function normalizeDistributionExportSections(value = {}) {
  return Object.fromEntries(DISTRIBUTION_EXPORT_SECTION_KEYS.map((key) => [key, value[key] !== false]));
}

export function composeDistributionReportSections(selection, sections = {}) {
  const normalized = normalizeDistributionExportSections(selection);
  return DISTRIBUTION_EXPORT_SECTION_KEYS
    .filter((key) => normalized[key])
    .map((key) => String(sections[key] || ""))
    .join("");
}
