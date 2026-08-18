export const MISSING_PERMIT_COMPANY_FILTER = "__permit_company_missing__";

export function permitCompanyFilterOptions(items = []) {
  return [...new Set((items || [])
    .map((item) => String(item?.permitCompany || "").trim())
    .filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "ko"));
}

export function matchesPermitCompanyFilter(item, filterValue = "all") {
  if (!filterValue || filterValue === "all") return true;
  const permitCompany = String(item?.permitCompany || "").trim();
  if (filterValue === MISSING_PERMIT_COMPANY_FILTER) return !permitCompany;
  return permitCompany === filterValue;
}
