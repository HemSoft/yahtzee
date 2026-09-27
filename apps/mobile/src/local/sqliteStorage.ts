import { SAVE_KEY } from "./save";
import type { StoragePort } from "./store";

export const DATABASE_NAME = "hemsoft-local-dice.db";
export interface SqlConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...parameters: string[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...parameters: string[]): Promise<T | null>;
  closeAsync(): Promise<void>;
}
export interface SqlFactory {
  open(): Promise<SqlConnection>;
  remove(): Promise<void>;
}

async function initialize(database: SqlConnection) {
  const integrity = await database.getFirstAsync<{ quick_check: string }>("PRAGMA quick_check");
  if (integrity?.quick_check !== "ok") throw new Error("Local database is damaged. Your data has not been reset.");
  const version = await database.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  if (version?.user_version !== 0 && version?.user_version !== 1) throw new Error("Local database uses an unsupported version. Your data has not been reset.");
  if (version.user_version === 0) await initializeEmpty(database);
  // Validate the expected table before changing any settings on an existing database.
  await database.getFirstAsync("SELECT key, value FROM local_save LIMIT 1");
  await database.execAsync("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;");
}
async function initializeEmpty(database: SqlConnection) {
  const existing = await database.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' LIMIT 1");
  if (existing) throw new Error("Unrecognized local database. Your data has not been reset.");
  await database.execAsync("BEGIN IMMEDIATE; CREATE TABLE local_save (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL); PRAGMA user_version = 1; COMMIT;");
}

/** Single-document SQL commits. Only an explicit reset can remove the dedicated database. */
export function createSqliteStorage(factory: SqlFactory, legacy: StoragePort) {
  let connection: Promise<SqlConnection> | null = null;
  let initialized = false;
  const close = async () => {
    const database = await connection?.catch(() => null);
    if (database) await database.closeAsync();
    connection = null;
    initialized = false;
  };
  const ready = async () => {
    connection ??= factory.open();
    const database = await connection;
    if (!initialized) { await initialize(database); initialized = true; }
    return database;
  };
  return {
    close,
    async getItem(key: string) {
      if (key !== SAVE_KEY) return legacy.getItem(key);
      // Explicit load/reload gets a new connection and checks the on-disk database.
      await close();
      const row = await (await ready()).getFirstAsync<{ value: unknown }>("SELECT value FROM local_save WHERE key = ?", key);
      if (!row) return null;
      if (typeof row.value !== "string") throw new Error("Local save is not text. Your data has not been reset.");
      return row.value;
    },
    async setItem(key: string, value: string) {
      if (key !== SAVE_KEY) return legacy.setItem(key, value);
      await (await ready()).runAsync("INSERT INTO local_save (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
    },
    async removeItem(key: string) {
      if (key !== SAVE_KEY) return legacy.removeItem(key);
      await (await ready()).runAsync("DELETE FROM local_save WHERE key = ?", key);
    },
    async reset() { await close(); await factory.remove(); },
  };
}

/** Expo's deleteDatabaseAsync rejects missing files. Reset is idempotent, including sidecars. */
export async function removeDatabaseFiles(remove: (name: string) => Promise<void>) {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    try { await remove(DATABASE_NAME + suffix); }
    catch (error) { if (!isMissingDatabase(error)) throw error; }
  }
}
function isMissingDatabase(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ERR_DATABASE_NOT_FOUND";
}
