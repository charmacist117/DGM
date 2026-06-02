export function downloadFile(filename, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
}

export function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    "\uFEFF" + headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ].join("\n");
}

const PROJECT_BACKUP_SCHEMA = "pharmadev_project_backup_v1";
const PROJECT_COLLECTION_FIELDS = [
  "tasks",
  "contracts",
  "communicationLog",
  "decisionLog",
  "advisorLog",
  "stageCheckLog",
  "changeLog"
];

function stableJson(value) {
  return JSON.stringify(value ?? null);
}

function stripCollections(project) {
  const payload = { ...(project || {}) };
  PROJECT_COLLECTION_FIELDS.forEach((field) => {
    delete payload[field];
  });
  return payload;
}

function labelForRecord(type, item) {
  if (!item || typeof item !== "object") return "";
  if (type === "tasks") return item.name || item.id || "";
  if (type === "contracts") return item.name || item.supplier || item.id || "";
  if (type === "communicationLog") return item.company || item.summary || item.id || "";
  if (type === "decisionLog") return item.title || item.description || item.id || "";
  if (type === "advisorLog") return item.name || item.content || item.id || "";
  if (type === "stageCheckLog") return item.taskName || item.taskId || item.id || "";
  if (type === "changeLog") return item.taskName || item.reason || item.id || "";
  if (type === "adminLog") return item.type || item.reason || item.id || "";
  return item.name || item.id || "";
}

function backupRow({ recordType, project, itemType, item, index }) {
  return {
    schema: PROJECT_BACKUP_SCHEMA,
    recordType,
    projectId: String(project?.id ?? ""),
    projectName: project?.name || "",
    itemType,
    itemId: String(item?.id ?? `${itemType}_${index + 1}`),
    sortOrder: index,
    label: labelForRecord(itemType, item),
    payloadJson: stableJson(item)
  };
}

export function projectToBackupCsv(project, adminLogs = []) {
  const safeProject = project || {};
  const rows = [
    backupRow({
      recordType: "project",
      project: safeProject,
      itemType: "project",
      item: stripCollections(safeProject),
      index: 0
    })
  ];

  PROJECT_COLLECTION_FIELDS.forEach((field) => {
    const items = Array.isArray(safeProject[field]) ? safeProject[field] : [];
    items.forEach((item, index) => {
      rows.push(backupRow({ recordType: "projectItem", project: safeProject, itemType: field, item, index }));
    });
  });

  const scopedAdminLogs = (Array.isArray(adminLogs) ? adminLogs : []).filter((log) => (
    String(log?.projectId ?? "") === String(safeProject.id ?? "")
  ));
  scopedAdminLogs.forEach((item, index) => {
    rows.push(backupRow({ recordType: "adminLog", project: safeProject, itemType: "adminLog", item, index }));
  });

  return toCsv(rows);
}

export function parseCsv(text) {
  const source = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        field += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => cell !== "")) rows.push(row);
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

export function projectFromBackupCsv(text) {
  const rows = parseCsv(text).filter((row) => row.schema === PROJECT_BACKUP_SCHEMA);
  if (rows.length === 0) {
    throw new Error("This is not a PharmaDev project backup CSV.");
  }

  const projectRow = rows.find((row) => row.recordType === "project");
  if (!projectRow) {
    throw new Error("Project metadata row was not found.");
  }

  const project = JSON.parse(projectRow.payloadJson || "{}");
  project.id = project.id ?? projectRow.projectId ?? Date.now();
  PROJECT_COLLECTION_FIELDS.forEach((field) => {
    project[field] = [];
  });

  const adminLogs = [];
  rows
    .filter((row) => row.recordType !== "project")
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .forEach((row) => {
      const payload = JSON.parse(row.payloadJson || "{}");
      if (row.recordType === "projectItem" && PROJECT_COLLECTION_FIELDS.includes(row.itemType)) {
        project[row.itemType].push(payload);
      }
      if (row.recordType === "adminLog") {
        adminLogs.push(payload);
      }
    });

  return { project, adminLogs };
}
