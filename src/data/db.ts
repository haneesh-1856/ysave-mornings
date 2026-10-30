import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import type { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrationsFile from './migrations/migrations';
import { relations } from './relations';

// The only file in the app that imports expo-sqlite.
const expoDb = openDatabaseSync('ysave.db', { enableChangeListener: true });
expoDb.execSync('PRAGMA foreign_keys = ON');

export const db = drizzle(expoDb, { relations });

/**
 * Pass to `useMigrations(db, migrations)` in the root layout. drizzle-orm 1.0.0-rc.5's typings still ask for
 * a `journal`, but its runtime only reads `migrations` (the format drizzle-kit generates), so we cast.
 */
export const migrations = migrationsFile as unknown as Parameters<typeof useMigrations>[1];
