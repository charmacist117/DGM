import { DRAFT_CHECKLIST_FIELDS, normalizeDraftChecklist } from "@/lib/pms/defaults";

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

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function getProjectOwner(project) {
  const pm = (project?.pmName || "").trim();
  const am = (project?.amName || "").trim();
  return [pm ? `PM ${pm}` : "", am ? `AM ${am}` : ""].filter(Boolean).join(" / ") || project?.manager || "";
}

function getTaskStats(project) {
  const tasks = Array.isArray(project?.tasks) ? project.tasks : [];
  return {
    total: tasks.length,
    completed: tasks.filter((task) => task.taskStatus === "completed").length,
    delayed: tasks.filter((task) => task.taskStatus === "delayed").length,
    avgProgress: tasks.length
      ? Math.round(tasks.reduce((sum, task) => sum + (Number(task.progress) || 0), 0) / tasks.length)
      : 0
  };
}

export function projectsToSummaryCsv(projects = []) {
  const rows = (Array.isArray(projects) ? projects : []).map((project, index) => {
    const stats = getTaskStats(project);
    return {
      no: index + 1,
      projectId: project?.id ?? "",
      projectName: project?.name || "",
      category: project?.category || "",
      owners: getProjectOwner(project),
      pmName: project?.pmName || "",
      amName: project?.amName || "",
      startDate: project?.start || "",
      status: project?.status || "",
      draftSummary: project?.desc || "",
      taskTotal: stats.total,
      completedTasks: stats.completed,
      delayedTasks: stats.delayed,
      averageProgress: stats.avgProgress,
      communicationLogs: Array.isArray(project?.communicationLog) ? project.communicationLog.length : 0,
      decisionLogs: Array.isArray(project?.decisionLog) ? project.decisionLog.length : 0,
      advisorLogs: Array.isArray(project?.advisorLog) ? project.advisorLog.length : 0,
      changeLogs: Array.isArray(project?.changeLog) ? project.changeLog.length : 0
    };
  });

  return toCsv(rows.length ? rows : [{
    no: "",
    projectId: "",
    projectName: "",
    category: "",
    owners: "",
    pmName: "",
    amName: "",
    startDate: "",
    status: "",
    draftSummary: "",
    taskTotal: "",
    completedTasks: "",
    delayedTasks: "",
    averageProgress: "",
    communicationLogs: "",
    decisionLogs: "",
    advisorLogs: "",
    changeLogs: ""
  }]);
}

export function projectsToChecklistCsv(projects = []) {
  const rows = (Array.isArray(projects) ? projects : []).map((project, index) => {
    const checklist = normalizeDraftChecklist(project?.draftChecklist);
    return {
      no: index + 1,
      projectId: project?.id ?? "",
      projectName: project?.name || "",
      category: project?.category || "",
      owners: getProjectOwner(project),
      startDate: project?.start || "",
      draftSummary: project?.desc || "",
      ...Object.fromEntries(DRAFT_CHECKLIST_FIELDS.map((field) => [field.label, checklist[field.key] || ""]))
    };
  });

  const emptyRow = {
    no: "",
    projectId: "",
    projectName: "",
    category: "",
    owners: "",
    startDate: "",
    draftSummary: "",
    ...Object.fromEntries(DRAFT_CHECKLIST_FIELDS.map((field) => [field.label, ""]))
  };
  return toCsv(rows.length ? rows : [emptyRow]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  bytes.forEach((byte) => {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(buffer, offset, value) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(buffer, offset, value) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
  buffer[offset + 3] = (value >>> 24) & 0xff;
}

function concatBytes(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

export function createCsvZip(files = []) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    const checksum = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeUint32(localHeader, 0, 0x04034b50);
    writeUint16(localHeader, 4, 20);
    writeUint16(localHeader, 6, 0x0800);
    writeUint16(localHeader, 8, 0);
    writeUint32(localHeader, 10, 0);
    writeUint32(localHeader, 14, checksum);
    writeUint32(localHeader, 18, dataBytes.length);
    writeUint32(localHeader, 22, dataBytes.length);
    writeUint16(localHeader, 26, nameBytes.length);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32(centralHeader, 0, 0x02014b50);
    writeUint16(centralHeader, 4, 20);
    writeUint16(centralHeader, 6, 20);
    writeUint16(centralHeader, 8, 0x0800);
    writeUint16(centralHeader, 10, 0);
    writeUint32(centralHeader, 12, 0);
    writeUint32(centralHeader, 16, checksum);
    writeUint32(centralHeader, 20, dataBytes.length);
    writeUint32(centralHeader, 24, dataBytes.length);
    writeUint16(centralHeader, 28, nameBytes.length);
    writeUint32(centralHeader, 42, offset);
    centralHeader.set(nameBytes, 46);

    localParts.push(localHeader, dataBytes);
    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  });

  const centralDirectory = concatBytes(centralParts);
  const end = new Uint8Array(22);
  writeUint32(end, 0, 0x06054b50);
  writeUint16(end, 8, files.length);
  writeUint16(end, 10, files.length);
  writeUint32(end, 12, centralDirectory.length);
  writeUint32(end, 16, offset);

  return new Blob([concatBytes([...localParts, centralDirectory, end])], { type: "application/zip" });
}

export function projectsToCsvBackupZip(projects = []) {
  return createCsvZip([
    {
      name: `01_전체_프로젝트_${formatDateTime(new Date()).replace(/[\\/:*?"<>|,\s]+/g, "_")}.csv`,
      content: projectsToSummaryCsv(projects)
    },
    {
      name: `02_체크리스트_${formatDateTime(new Date()).replace(/[\\/:*?"<>|,\s]+/g, "_")}.csv`,
      content: projectsToChecklistCsv(projects)
    }
  ]);
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
