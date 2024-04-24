import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../..";

class DatabaseContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "database",
    displayTitle: "Database",
    description: "Table schemas",
    type: "submenu",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const contextItems: ContextItem[] = [];

    const connections = this.options?.connections;

    if (connections === null) {
      return contextItems;
    }

    let [connectionName, table] = query.split(".");

    const getDatabaseAdapter = await require("dbinfoz");

    for (const connection of connections) {
      if (connection.name == connectionName) {
        const adapter = getDatabaseAdapter(
          connection.connection_type,
          connection.connection,
        );
        const tablesAndSchemas = await adapter.getAllTablesAndSchemas(
          connection.connection.database,
        );

        if (table === "all") {
          let prompt = `Schema for all tables on ${connection.connection_type} is `;
          prompt += JSON.stringify(tablesAndSchemas);

          let contextItem = {
            name: `${connectionName}-all-tables-schemas`,
            description: `Schema for all tables.`,
            content: prompt,
          };

          contextItems.push(contextItem);
        } else {
          const tables = Object.keys(tablesAndSchemas);

          tables.forEach((tableName) => {
            if (table === tableName) {
              let prompt = `Schema for ${tableName} on ${connection.connection_type} is `;
              prompt += JSON.stringify(tablesAndSchemas[tableName]);

              let contextItem = {
                name: `${connectionName}-${tableName}-schema`,
                description: `${tableName} Schema`,
                content: prompt,
              };

              contextItems.push(contextItem);
            }
          });
        }
      }
    }

    return contextItems;
  }

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const contextItems: ContextSubmenuItem[] = [];
    const connections = this.options?.connections;

    if (connections === null) {
      return contextItems;
    }

    const getDatabaseAdapter = await require("dbinfoz");

    for (const connection of connections) {
      let adapter = getDatabaseAdapter(
        connection.connection_type,
        connection.connection,
      );
      const tablesAndSchemas = await adapter.getAllTablesAndSchemas(
        connection.connection.database,
      );
      const tables = Object.keys(tablesAndSchemas);

      let contextItem = {
        id: `${connection.name}.all`,
        title: `${connection.name} all table schemas`,
        description: ``,
      };

      contextItems.push(contextItem);

      tables.forEach((tableName) => {
        let contextItem = {
          id: `${connection.name}.${tableName}`,
          title: `${connection.name}.${tableName} schema`,
          description: ``,
        };

        contextItems.push(contextItem);
      });
    }

    return contextItems;
  }
}

export default DatabaseContextProvider;
