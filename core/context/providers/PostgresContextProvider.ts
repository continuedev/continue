import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
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

  private async getTableNames(pool: any): Promise<string[]> {
    const schema = this.options.schema ?? "public";
    let tablesInfoQuery = `
SELECT table_schema, table_name
FROM information_schema.tables`;
    if (schema !== null) {
      tablesInfoQuery += ` WHERE table_schema = '${schema}'`;
    }
    const { rows: tablesInfo } = await pool.query(tablesInfoQuery);
    return tablesInfo.map(
      (tableInfo: any) => `${tableInfo.table_schema}.${tableInfo.table_name}`,
    );
  }

  async getContextItems(
    query = "",
    _: ContextProviderExtras = {} as ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const pool = await this.getPool();

    try {
      const contextItems: ContextItem[] = [];

      const tableNames = [];
      if (query === PostgresContextProvider.ALL_TABLES) {
        tableNames.push(...(await this.getTableNames(pool)));
      } else {
        tableNames.push(query);
      }

      for (const tableName of tableNames) {
        // Get the table schema
        if (!tableName.includes(".")) {
          throw new Error(
            `Table name must be in format schema.table_name, got ${tableName}`,
          );
        }
        const schemaQuery = `
SELECT column_name, data_type, character_maximum_length
FROM INFORMATION_SCHEMA.COLUMNS
WHERE table_schema = '${tableName.split(".")[0]}'
  AND table_name = '${tableName.split(".")[1]}'`;
        console.log("schemaQuery", schemaQuery);
        const { rows: tableSchema } = await pool.query(schemaQuery);

        // Get the sample rows
        const sampleRows =
          this.options.sampleRows ??
          PostgresContextProvider.DEFAULT_SAMPLE_ROWS;
        const { rows: sampleRowResults } = await pool.query(`
SELECT *
FROM ${tableName}
LIMIT ${sampleRows}`);

        // Create prompt from the table schema and sample rows
        let prompt = `Postgres schema for database ${this.options.database} table ${tableName}:\n`;
        prompt += `${JSON.stringify(tableSchema, null, 2)}\n\n`;
        prompt += `Sample rows: ${JSON.stringify(sampleRowResults, null, 2)}`;

        contextItems.push({
          name: `${this.options.database}-${tableName}-schema-and-sample-rows`,
          description: `Schema and sample rows for table ${tableName}`,
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
      const tableNames = await this.getTableNames(pool);

      for (const tableName of tableNames) {
        contextItems.push({
          id: tableName,
          title: tableName,
          description: `Schema from ${tableName} and ${this.options.sampleRows} sample rows.`,
        });
      }
      contextItems.push({
        id: PostgresContextProvider.ALL_TABLES,
        title: "All tables",
        description: `Schema from all tables and ${this.options.sampleRows} sample rows each.`,
      });

      return contextItems;
    } catch (error) {
      throw new Error(`Failed to query PostgreSQL database: ${error}`);
    }
  }

  get deprecationMessage() {
    return "The Postgres context provider is deprecated. Please consider using the Postgres MCP (such as github.com/crystaldba/postgres-mcp) instead.";
  }
}

export default PostgresContextProvider;
