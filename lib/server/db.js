import { Pool } from "pg";

function createPool() {
  const hasUrl = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
  if (hasUrl) {
    return new Pool({
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
    });
  }

  return new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
  });
}

const globalRef = globalThis;
export const pool = globalRef.__pharmadevPool || createPool();

if (!globalRef.__pharmadevPool) {
  globalRef.__pharmadevPool = pool;
}

export async function query(text, values = []) {
  return pool.query(text, values);
}
