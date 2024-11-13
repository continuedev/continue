import { type Database } from "sqlite";
import { Table } from "vectordb";

import { editConfigJson, migrate } from "../../util/paths.js";

import DocsService, { SqliteDocsRow } from "./DocsService.js";

export async function runLanceMigrations(table: Table) {
  await new Promise((resolve) =>
    migrate(
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
    ),
  );
}

export async function runSqliteMigrations(db: Database) {
  await new Promise((resolve) => {
    migrate(
      "sqlite_modify_docs_columns_and_copy_to_config",
      async () => {
        try {
          const pragma = await db.all(
            `PRAGMA table_info(${DocsService.sqlitebTableName})`,
          );

          const hasFaviconCol = pragma.some(
            (pragma) => pragma.name === "favicon",
          );
          const hasBaseUrlCol = pragma.some(
            (pragma) => pragma.name === "baseUrl",
          );

          if (!hasFaviconCol) {
            await db.exec(
              `ALTER TABLE ${DocsService.sqlitebTableName} ADD COLUMN favicon BLOB`,
            );
          }

          if (hasBaseUrlCol) {
            await db.exec(
              `ALTER TABLE ${DocsService.sqlitebTableName} RENAME COLUMN baseUrl TO startUrl`,
            );
          }

          const sqliteDocs = await db.all<
            Array<Pick<SqliteDocsRow, "title" | "startUrl">>
          >(`SELECT title, startUrl FROM ${DocsService.sqlitebTableName}`);

          editConfigJson((config) => ({
            ...config,
            docs: [...(config.docs || []), ...sqliteDocs],
          }));
        } finally {
          resolve(undefined);
        }
      },
      () => resolve(undefined),
    );
  });
}
