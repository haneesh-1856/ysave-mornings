import type { SQLiteAsyncDatabase } from 'drizzle-orm/sqlite-core';
import type { relations } from './relations';

/**
 * Driver-neutral, synchronous Drizzle SQLite database. The app passes the expo-sqlite
 * instance; tests pass an in-memory better-sqlite3 instance. Repos take this as their first arg.
 * (Drizzle v1 renamed BaseSQLiteDatabase to SQLiteAsyncDatabase<'sync' | 'async', ...>.)
 */
export type DB = SQLiteAsyncDatabase<'sync', unknown, typeof relations>;
