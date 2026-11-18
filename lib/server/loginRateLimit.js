import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { query, transaction } from "@/lib/server/db";

const MAX_ATTEMPTS = 8;
const WINDOW_SECONDS = 15 * 60;
let tableReady;

export async function reserveLoginAttempt(request) {
  const address = (request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const key = createHash("sha256").update(isIP(address) ? address : "unknown").digest("hex");
  tableReady ||= transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(73451210)");
    await client.query(`CREATE TABLE IF NOT EXISTS pms_login_attempts (
      client_key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at TIMESTAMPTZ NOT NULL
    )`);
  }).catch((error) => {
    tableReady = undefined;
    throw error;
  });
  await tableReady;
  await query("DELETE FROM pms_login_attempts WHERE expires_at <= NOW()");
  // Count the attempt atomically before checking the code across server instances.
  const result = await query(`
    INSERT INTO pms_login_attempts (client_key, attempts, expires_at)
    VALUES ($1, 1, NOW() + $3 * INTERVAL '1 second')
    ON CONFLICT (client_key) DO UPDATE SET attempts = pms_login_attempts.attempts + 1
    WHERE pms_login_attempts.attempts < $2
    RETURNING expires_at::text AS expires_at
  `, [key, MAX_ATTEMPTS, WINDOW_SECONDS]);
  return { key, expiresAt: result.rows[0]?.expires_at, retryAfter: WINDOW_SECONDS };
}

export function clearLoginAttempts({ key, expiresAt }) {
  return query("DELETE FROM pms_login_attempts WHERE client_key = $1 AND expires_at = $2", [key, expiresAt]);
}
