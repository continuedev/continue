import { type Database } from "sqlite";
import { type Table } from "vectordb";

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
    void migrate(
      "sqlite_modify_docs_columns_and_copy_to_config",
      async () => {
        try {
          const pragma = await db.all(
            `PRAGMA table_info(${DocsService.sqlitebTableName});`,
          );

          const hasFaviconCol = pragma.some(
            (pragma) => pragma.name === "favicon",
          );
          if (!hasFaviconCol) {
            await db.exec(
              `ALTER TABLE ${DocsService.sqlitebTableName} ADD COLUMN favicon BLOB;`,
            );
          }

          const hasBaseUrlCol = pragma.some(
            (pragma) => pragma.name === "baseUrl",
          );
          if (hasBaseUrlCol) {
            await db.exec(
              `ALTER TABLE ${DocsService.sqlitebTableName} RENAME COLUMN baseUrl TO startUrl;`,
            );
          }

          const needsToUpdateConfig = !hasFaviconCol || hasBaseUrlCol;
          if (needsToUpdateConfig) {
            const sqliteDocs = await db.all<
              Array<Pick<SqliteDocsRow, "title" | "startUrl">>
            >(`SELECT title, startUrl FROM ${DocsService.sqlitebTableName}`);
            editConfigJson((config) => ({
              ...config,
              docs: [...(config.docs || []), ...sqliteDocs],
            }));
          }
        } finally {
          resolve(undefined);
        }
      },
      () => resolve(undefined),
    );
  });

  await new Promise((resolve) => {
    void migrate(
      "sqlite_delete_docs_with_no_embeddingsProviderId",
      async () => {
        try {
          const pragma = await db.all(
            `PRAGMA table_info(${DocsService.sqlitebTableName});`,
          );
          const hasEmbeddingsProviderColumn = pragma.some(
            (pragma) => pragma.name === "embeddingsProviderId",
          );
          if (!hasEmbeddingsProviderColumn) {
            // gotta just delete in this case since old docs will be unusable anyway
            await db.exec(`DROP TABLE ${DocsService.sqlitebTableName};`);
          }
        } finally {
          resolve(undefined);
        }
      },
      () => resolve(undefined),
    );
  });
}
