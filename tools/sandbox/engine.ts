// The sandbox engine: a real SQLite database (sql.js, in the browser) migrated with the app's own migrations, wired
// into the app's dbRef, and the app's own clock override. Everything that changes data goes through the app's real
// state actions (src/state/actions/*); only snapshots (rewind / reopen) are sandbox-only.
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js/dist/sql-asm.js';
import { drizzle } from 'drizzle-orm/sql-js';

import migrationsFile from '@/data/migrations/migrations';
import { relations } from '@/data/relations';
import type { DB } from '@/data/types';
import { setClockOverride } from '@/state/clock';
import { setDb } from '@/state/dbRef';
import { bump, TABLES } from '@/state/store';

let SQL: SqlJsStatic | null = null;
let sqlite: Database | null = null;
let virtualNow = Date.now();

export const clock = {
  get: (): number => virtualNow,
  set: (ms: number): void => {
    virtualNow = Math.round(ms);
  },
  add: (ms: number): void => {
    virtualNow += Math.round(ms);
  },
};

function wire(db: Database): void {
  sqlite?.close();
  sqlite = db;
  sqlite.exec('PRAGMA foreign_keys = ON');
  setDb(drizzle(sqlite, { relations }) as unknown as DB);
  bump(...TABLES);
}

/** The app's migrations, applied in order the way drizzle's expo-sqlite migrator does (statement by statement). */
function migrate(db: Database): void {
  const all = (migrationsFile as unknown as { migrations: Record<string, string> }).migrations;
  for (const name of Object.keys(all).sort()) {
    for (const stmt of all[name].split('--> statement-breakpoint')) {
      if (stmt.trim()) db.exec(stmt);
    }
  }
}

export async function boot(): Promise<void> {
  SQL = await initSqlJs();
  setClockOverride(() => virtualNow);
}

/** A fresh, empty, migrated database (what a new install has). */
export function freshDb(): void {
  if (!SQL) throw new Error('boot() first');
  const db = new SQL.Database();
  migrate(db);
  wire(db);
}

export type Snapshot = { bytes: Uint8Array; now: number };

export function snapshot(): Snapshot {
  if (!sqlite) throw new Error('no database');
  return { bytes: sqlite.export(), now: virtualNow };
}

export function restore(s: Snapshot): void {
  if (!SQL) throw new Error('boot() first');
  wire(new SQL.Database(s.bytes));
  virtualNow = s.now;
}

/** Raw read for the inspector (row counts and so on). */
export function rawQuery(sql: string): Record<string, unknown>[] {
  if (!sqlite) return [];
  const res = sqlite.exec(sql);
  if (!res[0]) return [];
  const { columns, values } = res[0];
  return values.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
