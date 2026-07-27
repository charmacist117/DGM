import { Pool } from "pg";

function readEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return "";
}

function resolveDbConfig() {
  const connectionString = readEnv(
    "DATABASE_URL",
    "DATABASE_URL_UNPOOLED",
    "POSTGRES_URL",
    "POSTGRES_URL_NON_POOLING",
    "POSTGRES_PRISMA_URL"
  );

  if (connectionString) {
    return { mode: "url", connectionString };
  }

  const host = readEnv("PGHOST", "POSTGRES_HOST");
  const port = Number(readEnv("PGPORT", "POSTGRES_PORT") || 5432);
  const user = readEnv("PGUSER", "POSTGRES_USER");
  const password = readEnv("PGPASSWORD", "POSTGRES_PASSWORD");
  const database = readEnv("PGDATABASE", "POSTGRES_DATABASE");

  return {
    mode: "params",
    host,
    port,
    user,
    password,
    database
  };
}

function createPool() {
  const config = resolveDbConfig();
  const ssl = process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== "false" }
    : false;
  if (config.mode === "url") {
    return new Pool({
      connectionString: config.connectionString,
      ssl
    });
  }

  if (!config.host || !config.user || !config.password || !config.database) {
    throw new Error(
      "DB 환경변수가 없습니다. DATABASE_URL 또는 POSTGRES_URL(POSTGRES_* 세트)을 설정하고 재배포하세요."
    );
  }

  return new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl
  });
}

const globalRef = globalThis;

function getPool() {
  if (!globalRef.__pharmadevPool) {
    globalRef.__pharmadevPool = createPool();
  }
  return globalRef.__pharmadevPool;
}

export async function query(text, values = []) {
  return getPool().query(text, values);
}

export async function transaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
