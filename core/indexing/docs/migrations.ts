import type BetterSqlite3 from "better-sqlite3";
import { type Table } from "vectordb";

import { editConfigFile, migrate } from "../../util/paths.js";

import DocsService, { SqliteDocsRow } from "./DocsService.js";

export async function runLanceMigrations(table: Table) {
  await new Promise((resolve) => {
    void migrate(
      "rename_baseurl_column_for_lance_docs",
      async () => {
        try {
          const schema = await table.schema;

          if (schema.fields.some((field: any) => field.name === "baseurl")) {
            await table.alterColumns([{ path: "baseurl", rename: "starturl" }]);
          }
        } finally {
          resolve(undefined);
        }
      },
      () => resolve(undefined),
    );
  });
}

export function runSqliteMigrations(db: BetterSqlite3.Database) {
  void migrate("sqlite_modify_docs_columns_and_copy_to_config", async () => {
    const pragma = db
      .prepare(`PRAGMA table_info(${DocsService.sqlitebTableName});`)
      .all() as any[];

    const hasFaviconCol = pragma.some((pragma) => pragma.name === "favicon");
    if (!hasFaviconCol) {
      db.exec(
        `ALTER TABLE ${DocsService.sqlitebTableName} ADD COLUMN favicon BLOB;`,
      );
    }

    const hasBaseUrlCol = pragma.some((pragma) => pragma.name === "baseUrl");
    if (hasBaseUrlCol) {
      db.exec(
        `ALTER TABLE ${DocsService.sqlitebTableName} RENAME COLUMN baseUrl TO startUrl;`,
      );
    }

    const needsToUpdateConfig = !hasFaviconCol || hasBaseUrlCol;
    if (needsToUpdateConfig) {
      const sqliteDocs = db
        .prepare(`SELECT title, startUrl FROM ${DocsService.sqlitebTableName}`)
        .all() as Array<Pick<SqliteDocsRow, "title" | "startUrl">>;
      editConfigFile(
        (config) => ({
          ...config,
          docs: [...(config.docs || []), ...sqliteDocs],
        }),
        (config) => ({
          ...config,
          docs: [
            ...(config.docs || []),
            ...sqliteDocs.map((doc) => ({
              name: doc.title,
              startUrl: doc.startUrl,
            })),
          ],
        }),
      );
    }
  });

  void migrate("sqlite_delete_docs_with_no_embeddingsProviderId", async () => {
    const pragma = db
      .prepare(`PRAGMA table_info(${DocsService.sqlitebTableName});`)
      .all() as any[];
    const hasEmbeddingsProviderColumn = pragma.some(
      (pragma) => pragma.name === "embeddingsProviderId",
    );
    if (!hasEmbeddingsProviderColumn) {
      // gotta just delete in this case since old docs will be unusable anyway
      db.exec(`DROP TABLE ${DocsService.sqlitebTableName};`);
    }
  });
}
