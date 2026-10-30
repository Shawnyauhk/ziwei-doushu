import { Pool } from 'pg';

/**
 * Postgres 連線（用於保存按次購買的解讀次數）。
 * 以 globalThis 快取，避免 Next.js 熱重載時建立過多連線。
 */
const globalForDb = globalThis as unknown as {
  __ziweiPool?: Pool;
  __ziweiSchemaReady?: Promise<void>;
};

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL!.trim();
  const needsSsl = /sslmode=require|neon\.tech|supabase\.co|render\.com/i.test(connectionString);
  return new Pool({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function getPool(): Pool {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL_NOT_SET');
  }
  if (!globalForDb.__ziweiPool) {
    globalForDb.__ziweiPool = createPool();
  }
  return globalForDb.__ziweiPool;
}

const SCHEMA_SQL = `
create table if not exists visitors (
  id uuid primary key,
  created_at timestamptz not null default now()
);

create table if not exists credit_balances (
  visitor_id uuid primary key references visitors(id) on delete cascade,
  credits integer not null default 0 check (credits >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists purchases (
  session_id text primary key,
  visitor_id uuid not null references visitors(id) on delete cascade,
  email text,
  credits integer not null check (credits > 0),
  amount_total integer,
  currency text,
  status text not null default 'paid',
  created_at timestamptz not null default now()
);

create index if not exists purchases_visitor_idx on purchases (visitor_id, created_at desc);
`;

/** 首次使用時自動建表（冪等）。 */
export function ensureSchema(): Promise<void> {
  if (!globalForDb.__ziweiSchemaReady) {
    globalForDb.__ziweiSchemaReady = getPool()
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((error) => {
        globalForDb.__ziweiSchemaReady = undefined;
        throw error;
      });
  }
  return globalForDb.__ziweiSchemaReady;
}
