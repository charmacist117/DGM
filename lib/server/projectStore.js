import { getInitialProjects } from "@/lib/pms/defaults";
import { query } from "@/lib/server/db";

const STATE_ID = "main";

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS pms_state (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function loadProjects() {
  await ensureTable();
  const { rows } = await query("SELECT payload, updated_at FROM pms_state WHERE id = $1", [STATE_ID]);

  if (rows.length === 0) {
    const defaults = getInitialProjects();
    await saveProjects(defaults);
    return { projects: defaults, updatedAt: new Date().toISOString(), source: "seeded" };
  }

  return {
    projects: rows[0].payload || [],
    updatedAt: rows[0].updated_at?.toISOString?.() || new Date().toISOString(),
    source: "database"
  };
}

export async function saveProjects(projects) {
  await ensureTable();
  const payload = JSON.stringify(projects);

  const { rows } = await query(
    `
      INSERT INTO pms_state (id, payload, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
      RETURNING updated_at;
    `,
    [STATE_ID, payload]
  );

  return {
    ok: true,
    updatedAt: rows[0].updated_at?.toISOString?.() || new Date().toISOString()
  };
}
