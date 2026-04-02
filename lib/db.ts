import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import pg from 'pg';

/* eslint-disable @typescript-eslint/no-explicit-any */
type SqlTaggedTemplate = {
  (strings: TemplateStringsArray, ...values: any[]): Promise<Record<string, any>[]>;
  query: (text: string, values?: any[]) => Promise<Record<string, any>[]>;
};

let cachedSql: SqlTaggedTemplate | null = null;

function isNeonUrl(url: string): boolean {
  return url.includes('neon.tech') || url.includes('neon.aws');
}

function createPgSql(connectionString: string): SqlTaggedTemplate {
  const pool = new pg.Pool({ connectionString });

  const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.reduce(
      (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''),
      ''
    );
    const result = await pool.query(text, values);
    return result.rows;
  };

  sql.query = async (text: string, values?: unknown[]) => {
    const result = await pool.query(text, values ?? []);
    return result.rows;
  };

  return sql;
}

function createNeonSql(connectionString: string): SqlTaggedTemplate {
  const sql = neon(connectionString) as NeonQueryFunction<false, false>;
  // neon() already supports tagged templates and .query()
  return sql as unknown as SqlTaggedTemplate;
}

export function getDb(): SqlTaggedTemplate {
  if (cachedSql) return cachedSql;

  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL or POSTGRES_URL environment variable is required');
  }

  cachedSql = isNeonUrl(databaseUrl)
    ? createNeonSql(databaseUrl)
    : createPgSql(databaseUrl);

  return cachedSql;
}

export async function migrate() {
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      api_key       TEXT UNIQUE NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS test_runs (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      timestamp     TIMESTAMPTZ NOT NULL,
      server        TEXT NOT NULL,
      protocol      TEXT NOT NULL,
      direction     TEXT NOT NULL,
      duration_sec  INTEGER NOT NULL,
      tx_avg_mbps   DOUBLE PRECISION NOT NULL,
      rx_avg_mbps   DOUBLE PRECISION NOT NULL,
      tx_bytes      BIGINT NOT NULL,
      rx_bytes      BIGINT NOT NULL,
      lost          BIGINT NOT NULL DEFAULT 0,
      public_ip     TEXT,
      lan_ip        TEXT,
      ssid          TEXT,
      device_id     TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_test_runs_user ON test_runs(user_id, created_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS test_intervals (
      id            BIGSERIAL PRIMARY KEY,
      run_id        UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
      interval_sec  INTEGER NOT NULL,
      direction     TEXT NOT NULL,
      speed_mbps    DOUBLE PRECISION NOT NULL,
      bytes         BIGINT NOT NULL,
      local_cpu     INTEGER,
      remote_cpu    INTEGER,
      lost          BIGINT
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_test_intervals_run ON test_intervals(run_id, interval_sec)`;

  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash    TEXT NOT NULL,
      expires_at    TIMESTAMPTZ NOT NULL,
      used          BOOLEAN DEFAULT FALSE,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Migrations for existing databases
  await sql`ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS device_id TEXT`;
}
