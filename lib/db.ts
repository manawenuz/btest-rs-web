import { neon } from '@neondatabase/serverless';

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL or POSTGRES_URL environment variable is required');
  }
  return neon(databaseUrl);
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
}
