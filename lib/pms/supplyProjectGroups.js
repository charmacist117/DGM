const clean = (value) => String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
const keyText = (value) => clean(value).toLowerCase();

function groupColor(key) {
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  const unsigned = hash >>> 0;
  return `hsl(${unsigned % 360} 70% ${44 + ((unsigned >>> 9) % 3) * 5}%)`;
}

export function groupSupplyProjects(items, projects) {
  const byProjectId = new Map(projects.map((project) => [String(project.id), project]));
  const bySourceId = new Map(projects.filter((project) => project.sourceSupplyItemId != null && project.sourceSupplyItemId !== "")
    .map((project) => [String(project.sourceSupplyItemId), project]));
  const byItemId = new Map();
  const byCategory = new Map();
  for (const item of items) {
    const itemId = String(item.id);
    const project = byProjectId.get(String(item.projectPromotion?.linkedProjectId)) ?? bySourceId.get(itemId);
    const name = clean(item.productName);
    const ingredients = (item.ingredients || []).map(({ name: ingredient, content }) =>
      [clean(ingredient), clean(content)].filter(Boolean).join(" / ")).filter(Boolean);
    const key = project ? `project:${project.id}` : name || ingredients.length
      ? `product:${JSON.stringify([item.category, keyText(name), ingredients.map(keyText).sort()])}`
      : "unassigned";
    const label = project ? (clean(project.name) || "이름 없는 프로젝트")
      : [name, ingredients.join(" · ")].filter(Boolean).join(" · ") || "제품 정보 미입력";
    const group = { key, label, linked: Boolean(project), color: key === "unassigned" ? "#64748b" : groupColor(key) };
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
