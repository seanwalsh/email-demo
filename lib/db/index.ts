import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

// Prototype: schema is created in place. Switch to drizzle-kit migrations when
// moving to hosted Postgres.
const DDL = `
CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  carrier TEXT NOT NULL,
  sender TEXT NOT NULL,
  status TEXT NOT NULL,
  eta TEXT,
  thread_id TEXT NOT NULL,
  latest_message_id TEXT NOT NULL,
  dismissed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS shipments_account_tracking ON shipments (account_id, tracking_number);
CREATE TABLE IF NOT EXISTS processed_messages (
  account_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  automation_id TEXT NOT NULL,
  ignored INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS processed_unique ON processed_messages (account_id, message_id, automation_id);
CREATE TABLE IF NOT EXISTS action_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  automation_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  added_label_ids TEXT NOT NULL,
  removed_label_ids TEXT NOT NULL,
  undone_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS action_log_account ON action_log (account_id, created_at);
CREATE TABLE IF NOT EXISTS settings (
  account_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS settings_unique ON settings (account_id, key);
`;

export function createDb(file: string) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(DDL);
  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as { __db?: Db };

// Reuse one connection across dev hot reloads.
export function getDb(): Db {
  return (globalForDb.__db ??= createDb(path.join(process.cwd(), "data", "app.db")));
}
