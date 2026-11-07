import { open, type Database } from "sqlite";
import type sqlite3 from "sqlite3";

let sqlite3Promise: Promise<typeof sqlite3> | undefined;

/**
 * Loads the native sqlite3 driver on first use.
 *
 * sqlite3 is a native module. A top-level import loads its binary as soon as
 * any importing module is evaluated, so when the binary cannot be loaded (for
 * example Windows Smart App Control blocks it because it is unsigned) every
 * importer fails and the extension cannot activate. Loading it here keeps
 * that failure inside the features that open a database.
 */
export function loadSqlite3(): Promise<typeof sqlite3> {
  sqlite3Promise ??= import("sqlite3")
    .then((mod) => (mod as { default?: typeof sqlite3 }).default ?? mod)
    .catch((error: unknown) => {
      sqlite3Promise = undefined;
      throw error;
    });
  return sqlite3Promise;
}

export async function openSqliteDatabase(
  filename: string,
): Promise<Database<sqlite3.Database>> {
  const driver = await loadSqlite3();
  return open({ filename, driver: driver.Database });
}
