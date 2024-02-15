import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  LoadSubmenuItemsArgs,
  ContextSubmenuItem,
} from "../..";

const ALL_TABLES = "__all_tables";
const DEFAULT_SAMPLE_ROWS = 3;

class PostgresContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "postgres",
    displayTitle: "PostgreSQL",
    description: "Retrieve PostgreSQL table schema and sample rows",
    type: "submenu",
  };

  constructor(options: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    schema?: string;
    sampleRows?: number;
  }) {
    super(options);
  }

  private async getPool() {
    const pg = await require("pg");
    return new pg.Pool({
      host: this.options.host,
      port: this.options.port,
      user: this.options.user,
      password: this.options.password,
      database: this.options.database,
    });
  }

  async getContextItems(
    query: string = "",
    _: ContextProviderExtras = {} as ContextProviderExtras
  ): Promise<ContextItem[]> {
    const pool = await this.getPool();

    try {
      const contextItems: ContextItem[] = [];

      var schemaQuery = `
SELECT column_name, data_type, character_maximum_length
FROM INFORMATION_SCHEMA.COLUMNS`;
      if (this.options.query != ALL_TABLES) {
        // Get the table schema
        const tableName = query;
        if (!tableName.includes(".")) {
          throw new Error(
            `Table name must be in format schema.table_name, got ${tableName}`
          );
        }
        schemaQuery += `WHERE table_name = '${tableName.split(".")[1]}'`;
      }

      const { rows: tableSchemas } = await pool.query(schemaQuery);

      var prompt = `Postgres schema for database ${this.options.database}`;
      for (const tableSchema of tableSchemas) {
        const tableName = query;

        // Get the sample rows
        const sampleRows = this.options.sampleRows ?? DEFAULT_SAMPLE_ROWS;
        const { rows: sampleRowResults } = await pool.query(`
SELECT *
FROM ${tableName}
LIMIT ${sampleRows}`);

        // Create prompt from the table schema and sample rows
        var prompt = `Table schema for ${tableName}:\n${JSON.stringify(
          tableSchema,
          null,
          2
        )}\n\n`;
        prompt += `Sample rows: ${JSON.stringify(sampleRowResults, null, 2)}`;
      }

      contextItems.push({
        name: `${this.options.database}-${query}-schema-and-sample-rows`,
        description: `Schema and sample rows for ${
          query == ALL_TABLES ? "all table" : query
        } in ${this.options.database} database`,
        content: prompt,
      });

      return contextItems;
    } catch (error) {
      throw new Error(`Failed to query PostgreSQL database: ${error}`);
    } finally {
    }
  }

  async loadSubmenuItems(
    _: LoadSubmenuItemsArgs
  ): Promise<ContextSubmenuItem[]> {
    const pool = await this.getPool();

    const schema = this.options.schema ?? "public";
    var tablesInfoQuery = `
SELECT table_schema, table_name
FROM information_schema.tables`;
    if (schema != null) {
      tablesInfoQuery += ` WHERE table_schema = '${schema}'`;
    }
    const tablesInfo = await pool.query(tablesInfoQuery).rows;

    try {
      const contextItems: ContextSubmenuItem[] = [];

      for (const tableInfo of tablesInfo) {
        const tableName = `${tableInfo.table_schema}.${tableInfo.table_name}`;

        contextItems.push({
          id: tableName,
          title: tableName,
          description: `Schema from ${tableName} and ${this.options.sampleRows} sample rows.`,
        });
        contextItems.push({
          id: ALL_TABLES,
          title: "All tables",
          description: `Schema from all tables and ${this.options.sampleRows} sample rows each.`,
        });
      }

      return contextItems;
    } catch (error) {
      throw new Error(`Failed to query PostgreSQL database: ${error}`);
    }
  }
}

export default PostgresContextProvider;
