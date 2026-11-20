const modules = new Set(["home", "development", "medicine-standard", "supply", "distribution", "market", "promotion", "schedule", "contract", "transfer"]);
const scheduleTabs = new Set(["overview", "tasks", "advisor", "communication", "decision", "basic", "project_logs"]);
const settingsSections = new Set(["server", "accounts", "transfer"]);

export function readPmsView(search = "") {
  const params = new URLSearchParams(search);
  const project = params.get("project") || "";
  const requestedModule = params.get("view");
  const moduleTab = modules.has(requestedModule) ? requestedModule : project ? "schedule" : "development";
  return {
    moduleTab,
    category: ["supply", "distribution", "market"].includes(moduleTab) ? (params.get("category") || "all") : "all",
    group: moduleTab === "supply" ? (params.get("group") || "") : "",
    item: ["supply", "distribution", "market", "promotion", "medicine-standard", "contract"].includes(moduleTab) ? (params.get("item") || "") : "",
    scenario: moduleTab === "distribution" ? (params.get("scenario") || "") : "",
    project: moduleTab === "schedule" ? project : "",
    tab: moduleTab === "schedule" && project && scheduleTabs.has(params.get("tab")) ? params.get("tab") : "overview",
    section: moduleTab === "transfer" && settingsSections.has(params.get("section")) ? params.get("section") : "server",
    parent: moduleTab === "contract" ? (params.get("parent") || "all") : "all",
    stage: moduleTab === "development" ? (params.get("stage") || "all") : "all"
  };
}

export function writePmsView(view) {
  const params = new URLSearchParams();
  if (view.moduleTab !== "development") params.set("view", view.moduleTab);
  if (view.category && view.category !== "all") params.set("category", view.category);
  if (view.group) params.set("group", view.group);
  if (view.item) params.set("item", view.item);
  if (view.scenario) params.set("scenario", view.scenario);
  if (view.project) params.set("project", view.project);
  if (view.tab && view.tab !== "overview") params.set("tab", view.tab);
  if (view.section && view.section !== "server") params.set("section", view.section);
  if (view.parent && view.parent !== "all") params.set("parent", view.parent);
  if (view.stage && view.stage !== "all") params.set("stage", view.stage);
  return params.toString();
}
