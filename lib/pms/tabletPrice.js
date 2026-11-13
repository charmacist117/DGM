export function tabletsPerPack(packagingUnit, packagingForm) {
  const value = String(packagingUnit ?? "").trim();
  const match = value.match(/^(\d+)\s*(정)?$/);
  if (!match || (!match[2] && String(packagingForm ?? "").trim() !== "정")) return null;
  const count = Number(match[1]);
  return Number.isSafeInteger(count) && count > 0 ? count : null;
}

export function convertTabletPrice(value, count, direction) {
  if (!String(value ?? "").trim() || !count) return null;
  const price = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(price) || price < 0) return null;
  return Number((direction === "pack" ? price * count : price / count).toPrecision(12));
}
