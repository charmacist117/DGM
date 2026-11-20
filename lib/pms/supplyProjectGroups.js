const clean = (value) => String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
const keyText = (value) => clean(value).toLowerCase();

function groupColor(key) {
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  const unsigned = hash >>> 0;
  return `hsl(${unsigned % 360} 70% ${44 + ((unsigned >>> 9) % 3) * 5}%)`;
}

export function groupSupplyProjects(items) {
  const byItemId = new Map();
  const byCategory = new Map();
  for (const item of items) {
    const itemId = String(item.id);
    const name = clean(item.supplyProjectName);
    const key = name ? `project:${keyText(name)}` : "unassigned";
    const group = { key, label: name || "프로젝트 미지정", assigned: Boolean(name), color: name ? groupColor(key) : "#64748b" };
    byItemId.set(itemId, group);
    for (const category of ["all", item.category]) {
      if (!byCategory.has(category)) byCategory.set(category, new Map());
      const groups = byCategory.get(category);
      if (!groups.has(key)) groups.set(key, { ...group, count: 0 });
      groups.get(key).count++;
    }
  }
  return { byItemId, byCategory };
}
