export function matchesManufacturerSearch(item, query = "") {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const manufacturer = String(item?.manufacturer || "").trim();
  if (normalizedQuery === "미입력") return !manufacturer;
  return !normalizedQuery || manufacturer.toLowerCase().includes(normalizedQuery);
}
