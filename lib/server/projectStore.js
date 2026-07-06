import { getInitialProjects } from "@/lib/pms/defaults";
import { query, transaction } from "@/lib/server/db";

const STATE_ID = "main";
const PROJECT_ITEM_FIELDS = [
  "contracts",
  "communicationLog",
  "decisionLog",
  "advisorLog",
  "stageCheckLog",
  "changeLog"
];

function normalizePayload(payload) {
  if (Array.isArray(payload)) {
    return { projects: payload, adminLogs: [], supplyPriceItems: [] };
  }
  if (payload && typeof payload === "object") {
    return {
      projects: Array.isArray(payload.projects) ? payload.projects : [],
      adminLogs: Array.isArray(payload.adminLogs) ? payload.adminLogs : [],
      supplyPriceItems: Array.isArray(payload.supplyPriceItems) ? payload.supplyPriceItems : []
    };
  }
  return { projects: [], adminLogs: [], supplyPriceItems: [] };
}

function toIso(value) {
  if (!value) return new Date().toISOString();
  return value?.toISOString?.() || new Date(value).toISOString();
}

function asTextId(value, fallback) {
  const raw = value ?? fallback;
  return String(raw || fallback);
}

function toObjectPayload(value, fallbackId) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...value, id: value.id ?? fallbackId };
  }
  return { id: fallbackId, value };
}

function uniqueKey(value, fallback, usedKeys) {
  const base = asTextId(value, fallback);
  let key = base;
  let suffix = 2;
  while (usedKeys.has(key)) {
    key = `${base}_${suffix}`;
    suffix += 1;
  }
  usedKeys.add(key);
  return key;
}

function stripProjectCollections(project) {
  const payload = { ...(project || {}) };
  delete payload.tasks;
  PROJECT_ITEM_FIELDS.forEach((field) => {
    delete payload[field];
  });
  return payload;
}

function groupRows(rows, keySelector, valueSelector) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keySelector(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(valueSelector(row));
  });
  return map;
}

async function ensureTables() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS pms_state (
        id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pms_projects (
        id TEXT PRIMARY KEY,
        sort_order INTEGER NOT NULL DEFAULT 0,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pms_tasks (
        project_id TEXT NOT NULL REFERENCES pms_projects(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (project_id, id)
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pms_project_items (
        project_id TEXT NOT NULL REFERENCES pms_projects(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        item_key TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (project_id, kind, item_key)
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pms_admin_logs (
        id TEXT PRIMARY KEY,
        sort_order INTEGER NOT NULL DEFAULT 0,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pms_supply_price_items (
        id TEXT PRIMARY KEY,
        sort_order INTEGER NOT NULL DEFAULT 0,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await query("CREATE INDEX IF NOT EXISTS pms_tasks_project_order_idx ON pms_tasks(project_id, sort_order);");
    await query("CREATE INDEX IF NOT EXISTS pms_project_items_project_kind_order_idx ON pms_project_items(project_id, kind, sort_order);");
    await query("CREATE INDEX IF NOT EXISTS pms_admin_logs_order_idx ON pms_admin_logs(sort_order);");
    await query("CREATE INDEX IF NOT EXISTS pms_supply_price_items_order_idx ON pms_supply_price_items(sort_order);");
  } catch (error) {
    throw new Error(`DB table preparation failed: ${String(error?.message || error)}`);
  }
}

async function loadLegacyState() {
  const result = await query("SELECT payload FROM pms_state WHERE id = $1", [STATE_ID]);
  return normalizePayload(result.rows[0]?.payload);
}

async function seedFromLegacyOrDefaults() {
  const legacy = await loadLegacyState();
  if (legacy.projects.length > 0 || legacy.adminLogs.length > 0 || legacy.supplyPriceItems.length > 0) {
    const saved = await saveProjects(legacy.projects, legacy.adminLogs, legacy.supplyPriceItems);
    return {
      projects: legacy.projects,
      adminLogs: legacy.adminLogs,
      supplyPriceItems: legacy.supplyPriceItems,
      updatedAt: saved.updatedAt,
      source: "migrated-from-json-state"
    };
  }

  const defaults = getInitialProjects();
  const saved = await saveProjects(defaults, [], []);
  return {
    projects: defaults,
    adminLogs: [],
    supplyPriceItems: [],
    updatedAt: saved.updatedAt,
    source: "seeded"
  };
}

export async function loadProjects() {
  await ensureTables();

  let projectRows;
  try {
    const result = await query(`
      SELECT id, sort_order, payload, updated_at
      FROM pms_projects
      ORDER BY sort_order ASC, updated_at ASC, id ASC;
    `);
    projectRows = result.rows;
  } catch (error) {
    throw new Error(`Project load failed: ${String(error?.message || error)}`);
  }

  try {
    const supplyItemResult = await query(`
        SELECT id, sort_order, payload, updated_at
        FROM pms_supply_price_items
        ORDER BY sort_order ASC, updated_at ASC, id ASC;
      `);

    if (projectRows.length === 0 && supplyItemResult.rows.length === 0) {
      return seedFromLegacyOrDefaults();
    }

    const taskResult = await query(`
        SELECT project_id, id, sort_order, payload
        FROM pms_tasks
        ORDER BY project_id ASC, sort_order ASC, id ASC;
      `);
    const itemResult = await query(`
        SELECT project_id, kind, item_key, sort_order, payload
        FROM pms_project_items
        ORDER BY project_id ASC, kind ASC, sort_order ASC, item_key ASC;
      `);
    const adminLogResult = await query(`
        SELECT id, sort_order, payload, updated_at
        FROM pms_admin_logs
        ORDER BY sort_order ASC, updated_at ASC, id ASC;
      `);

    const tasksByProject = groupRows(
      taskResult.rows,
      (row) => String(row.project_id),
      (row) => row.payload || { id: row.id }
    );

    const itemsByProjectAndKind = groupRows(
      itemResult.rows,
      (row) => `${row.project_id}:${row.kind}`,
      (row) => row.payload || { id: row.item_key }
    );

    const projects = projectRows.map((row) => {
      const projectId = String(row.id);
      const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
      const project = {
        ...payload,
        id: payload.id ?? projectId,
        tasks: tasksByProject.get(projectId) || []
      };

      PROJECT_ITEM_FIELDS.forEach((field) => {
        project[field] = itemsByProjectAndKind.get(`${projectId}:${field}`) || [];
      });

      return project;
    });

    const adminLogs = adminLogResult.rows.map((row) => row.payload || { id: row.id });
    const supplyPriceItems = supplyItemResult.rows.map((row) => row.payload || { id: row.id });
    const updateRows = [...projectRows, ...adminLogResult.rows, ...supplyItemResult.rows];
    const latestUpdate = updateRows.reduce(
      (latest, row) => (new Date(row.updated_at) > new Date(latest) ? row.updated_at : latest),
      updateRows[0]?.updated_at || new Date()
    );

    return {
      projects,
      adminLogs,
      supplyPriceItems,
      updatedAt: toIso(latestUpdate),
      source: "database-normalized"
    };
  } catch (error) {
    throw new Error(`Project reconstruction failed: ${String(error?.message || error)}`);
  }
}

export async function saveProjects(projects, adminLogs = [], supplyPriceItems = []) {
  await ensureTables();

  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeAdminLogs = Array.isArray(adminLogs) ? adminLogs : [];
  const safeSupplyPriceItems = Array.isArray(supplyPriceItems) ? supplyPriceItems : [];

  try {
    const updatedAt = await transaction(async (client) => {
      const projectIds = safeProjects.map((project, index) => asTextId(project?.id, `project_${index + 1}`));
      await client.query("DELETE FROM pms_projects WHERE NOT (id = ANY($1::text[]));", [projectIds]);

      for (const [projectIndex, sourceProject] of safeProjects.entries()) {
        const projectId = asTextId(sourceProject?.id, `project_${projectIndex + 1}`);
        const project = { ...(sourceProject || {}), id: sourceProject?.id ?? projectId };
        const projectPayload = stripProjectCollections(project);

        await client.query(
          `
            INSERT INTO pms_projects (id, sort_order, payload, updated_at)
            VALUES ($1, $2, $3::jsonb, NOW())
            ON CONFLICT (id)
            DO UPDATE SET sort_order = EXCLUDED.sort_order, payload = EXCLUDED.payload, updated_at = NOW();
          `,
          [projectId, projectIndex, JSON.stringify(projectPayload)]
        );

        await client.query("DELETE FROM pms_tasks WHERE project_id = $1;", [projectId]);
        await client.query("DELETE FROM pms_project_items WHERE project_id = $1;", [projectId]);

        const usedTaskKeys = new Set();
        for (const [taskIndex, sourceTask] of (Array.isArray(project.tasks) ? project.tasks : []).entries()) {
          const taskId = uniqueKey(sourceTask?.id, `task_${taskIndex + 1}`, usedTaskKeys);
          const taskPayload = toObjectPayload(sourceTask, taskId);

          await client.query(
            `
              INSERT INTO pms_tasks (project_id, id, sort_order, payload, updated_at)
              VALUES ($1, $2, $3, $4::jsonb, NOW());
            `,
            [projectId, taskId, taskIndex, JSON.stringify(taskPayload)]
          );
        }

        for (const field of PROJECT_ITEM_FIELDS) {
          const usedItemKeys = new Set();
          const items = Array.isArray(project[field]) ? project[field] : [];

          for (const [itemIndex, sourceItem] of items.entries()) {
            const itemKey = uniqueKey(sourceItem?.id, `${field}_${itemIndex + 1}`, usedItemKeys);
            const itemPayload = toObjectPayload(sourceItem, itemKey);

            await client.query(
              `
                INSERT INTO pms_project_items (project_id, kind, item_key, sort_order, payload, updated_at)
                VALUES ($1, $2, $3, $4, $5::jsonb, NOW());
              `,
              [projectId, field, itemKey, itemIndex, JSON.stringify(itemPayload)]
            );
          }
        }
      }

      await client.query("DELETE FROM pms_admin_logs;");
      const usedLogKeys = new Set();
      for (const [logIndex, sourceLog] of safeAdminLogs.entries()) {
        const logId = uniqueKey(sourceLog?.id, `admin_log_${logIndex + 1}`, usedLogKeys);
        const logPayload = toObjectPayload(sourceLog, logId);

        await client.query(
          `
            INSERT INTO pms_admin_logs (id, sort_order, payload, updated_at)
            VALUES ($1, $2, $3::jsonb, NOW());
          `,
          [logId, logIndex, JSON.stringify(logPayload)]
        );
      }

      await client.query("DELETE FROM pms_supply_price_items;");
      const usedSupplyPriceKeys = new Set();
      for (const [itemIndex, sourceItem] of safeSupplyPriceItems.entries()) {
        const itemId = uniqueKey(sourceItem?.id, `supply_price_${itemIndex + 1}`, usedSupplyPriceKeys);
        const itemPayload = toObjectPayload(sourceItem, itemId);

        await client.query(
          `
            INSERT INTO pms_supply_price_items (id, sort_order, payload, updated_at)
            VALUES ($1, $2, $3::jsonb, NOW());
          `,
          [itemId, itemIndex, JSON.stringify(itemPayload)]
        );
      }

      const result = await client.query("SELECT NOW() AS updated_at;");
      return toIso(result.rows[0]?.updated_at);
    });

    return { ok: true, updatedAt };
  } catch (error) {
    throw new Error(`Project save failed: ${String(error?.message || error)}`);
  }
}
