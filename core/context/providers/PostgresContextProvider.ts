import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
  TableInfo,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

class PostgresContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "postgres",
    displayTitle: "PostgreSQL",
    description: "Retrieve PostgreSQL table schema and sample rows",
    type: "submenu",
    renderInlineAs: "",
  };

  static ALL_TABLES = "__all_tables";
  static DEFAULT_SAMPLE_ROWS = 3;

  // table types in information_schema.tables:
  //    BASE TABLE for a persistent base table (the normal table type),
  //    VIEW for a view,
  //    FOREIGN for a foreign table, or
  //    LOCAL TEMPORARY for a temporary table
  static tablesQuery = `
  SELECT table_schema, table_name, 
        CASE WHEN table_type = 'VIEW' THEN 'view' ELSE 'table' END AS table_type
  FROM information_schema.tables
  WHERE table_name like $1 AND table_schema like $2 AND ($3 = '' OR table_name !~* $3)
  union all
  select schemaname, matviewname, 'materialized view' from pg_matviews
  WHERE matviewname like $1 AND schemaname like $2 AND ($3 = '' OR matviewname !~* $3)`;
  static columnQuery = `
  SELECT
      a.attname AS column_name,
      format_type(a.atttypid, a.atttypmod)||case when a.attnotnull then ' not null' else '' end AS data_type
  FROM pg_attribute a
  JOIN pg_class c ON a.attrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = $1 AND c.relname like $2
  AND a.attnum > 0
  ORDER BY a.attnum`;
  static indexQuery = `
  SELECT indexname AS index_name, indexdef as index_definition FROM pg_indexes
  WHERE schemaname = $1 AND tablename = $2
  ORDER BY indexname`;
  static constraintQuery = `
  SELECT conname AS constraint_name,
         pg_get_constraintdef(c.oid) AS constraint_definition
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.connamespace
  WHERE n.nspname = $1 AND conrelid::regclass = $2::regclass
  ORDER BY conname`;
  static viewQuery = `
  SELECT view_definition 
  FROM information_schema.views 
  WHERE table_schema = $1 AND table_name = $2`;
  static materializedViewQuery = `
  SELECT pg_get_viewdef(matviewname::regclass, true) as view_definition
  FROM pg_matviews
  WHERE schemaname = $1 AND matviewname = $2`;

  private async getPool() {
    // @ts-ignore
    const pg = await import("pg");

    return new pg.Pool({
      host: this.options.host,
      port: this.options.port,
      user: this.options.user,
      password: this.options.password,
      database: this.options.database,
    });
  }

  private async getTableInfos(
    pool: any,
    table: string = "%",
  ): Promise<TableInfo[]> {
    const schema = this.options.schema ?? "public";
    const excludePattern = this.options.excludePattern ?? "";
    const { rows: tablesInfo } = await pool.query(
      PostgresContextProvider.tablesQuery,
      [table, schema, excludePattern],
    );
    // order tableInfos by table_name
    tablesInfo.sort((a: any, b: any) =>
      a.table_name.localeCompare(b.table_name),
    );
    return tablesInfo.map((tableInfo: any) => {
      const tableType = tableInfo.table_type || "undefined";
      return {
        schema: tableInfo.table_schema,
        name: tableInfo.table_name,
        type: tableType,
      };
    });
  }

  async getContextItems(
    query = "",
    _: ContextProviderExtras = {} as ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const pool = await this.getPool();

    try {
      const contextItems: ContextItem[] = [];

      const tableInfos: TableInfo[] = [];
      if (query === PostgresContextProvider.ALL_TABLES) {
        tableInfos.push(...(await this.getTableInfos(pool)));
      } else {
        if (!query.includes(" ")) {
          throw new Error(
            `Table name must be in format "table_name table_type", got ${query}`,
          );
        }
        const [tName, tType] = query.split(" ");
        tableInfos.push(...(await this.getTableInfos(pool, tName)));
      }

      for (const tableInfo of tableInfos) {
        // console.log("schemaQuery", schemaQuery);
        const { rows: tableSchema } = await pool.query(
          PostgresContextProvider.columnQuery,
          [tableInfo.schema, tableInfo.name],
        );

        // Get the number of sample rows
        const sampleRows =
          this.options.sampleRows ??
          PostgresContextProvider.DEFAULT_SAMPLE_ROWS;

        const fullName = `${tableInfo.schema}.${tableInfo.name}`;
        // Create prompt from the table information
        let prompt = `Postgres schema for database ${this.options.database} ${tableInfo.type} ${fullName}:\n`;
        prompt += `${JSON.stringify(tableSchema, null, 2)}\n\n`;

        // Get sample rows (not for views)
        if (tableInfo.type !== "view" && sampleRows > 0) {
          const samplesQuery = `SELECT * FROM ${tableInfo.schema}.${tableInfo.name} LIMIT $1`;
          const { rows: sampleRowResults } = await pool.query(samplesQuery, [
            sampleRows,
          ]);
          prompt += `Sample rows: ${JSON.stringify(sampleRowResults, null, 2)}\n\n`;
        }

        // Get indexes, foreign keys and sample rows for tables only
        if (tableInfo.type === "table") {
          // Get indexes
          // console.log("indexQuery", indexQuery);
          const { rows: indexDefinitionResults } = await pool.query(
            PostgresContextProvider.indexQuery,
            [tableInfo.schema, tableInfo.name],
          );
          prompt += `Indexes: ${JSON.stringify(indexDefinitionResults, null, 2)}\n\n`;

          // Get constraints
          const { rows: constraintDefinitionResults } = await pool.query(
            PostgresContextProvider.constraintQuery,
            [tableInfo.schema, fullName],
          );
          prompt += `Constraints: ${JSON.stringify(constraintDefinitionResults, null, 2)}`;
        } else if (tableInfo.type === "view") {
          // Get view definition statement
          const { rows: viewDefinitionResults } = await pool.query(
            PostgresContextProvider.viewQuery,
            [tableInfo.schema, tableInfo.name],
          );
          if (viewDefinitionResults.length > 0) {
            prompt += `View query: ${JSON.stringify(viewDefinitionResults[0].view_definition, null, 2)}`;
          }
        } else if (tableInfo.type === "materialized view") {
          // Get materialized view definition statement
          const { rows: matViewDefinitionResults } = await pool.query(
            PostgresContextProvider.materializedViewQuery,
            [tableInfo.schema, tableInfo.name],
          );
          if (matViewDefinitionResults.length > 0) {
            prompt += `Materialized view query: ${JSON.stringify(matViewDefinitionResults[0].view_definition, null, 2)}`;
          }
        }

        contextItems.push({
          name: `${this.options.database}-${tableInfo.schema}-${tableInfo.name}-schema`,
          description: `Schema and sample rows for ${tableInfo.type} ${fullName}`,
          content: prompt,
        });
      }

      return contextItems;
    } catch (error) {
      throw new Error(`Failed to query PostgreSQL database: ${error}`);
    } finally {
    }
  }

  async loadSubmenuItems(
    _: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const pool = await this.getPool();

    try {
      const contextItems: ContextSubmenuItem[] = [];
      const tableInfos = await this.getTableInfos(pool);

      // item "All tables" should be first in list
      contextItems.push({
        id: PostgresContextProvider.ALL_TABLES,
        title: "All tables",
        description: `All tables/views from schema ${this.options.schema ?? 'public'}`,
      });
      for (const tableInfo of tableInfos) {
        const shortType = tableInfo.type.startsWith('mat') ? 'matview' : tableInfo.type;
        const fullName = `${tableInfo.name} ${shortType}`;
        contextItems.push({
          id: fullName,
          title: fullName,
          description: '',
        });
      }

      return contextItems;
    } catch (error) {
      throw new Error(`Failed to query PostgreSQL database: ${error}`);
    }
  }
}

export default PostgresContextProvider;
