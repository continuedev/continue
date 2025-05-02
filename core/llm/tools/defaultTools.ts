/**
 * デフォルトで使用可能なツール定義
 * Continue拡張機能のAgentモードで利用されるツールのリスト
 */

export const defaultTools = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for information",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path to the file"
          }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path to the file"
          },
          content: {
            type: "string",
            description: "The content to write"
          }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_directory",
      description: "List all files and directories in a specified path",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path to list contents of"
          }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "repl",
      description: "Execute JavaScript code in a REPL environment",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "The JavaScript code to execute"
          }
        },
        required: ["code"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "execute_sql_query",
      description: "Execute a SQL query",
      parameters: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description: "The SQL query to execute"
          }
        },
        required: ["sql"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Search for files matching a pattern in a directory",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The base directory path to search in"
          },
          pattern: {
            type: "string",
            description: "The pattern to match file names against"
          },
          excludePatterns: {
            type: "array",
            items: {
              type: "string"
            },
            description: "Patterns to exclude from the search"
          }
        },
        required: ["path", "pattern"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description: "Make line-based edits to a text file",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path to the file to edit"
          },
          edits: {
            type: "array",
            items: {
              type: "object",
              properties: {
                oldText: {
                  type: "string",
                  description: "The text to be replaced (must match exactly)"
                },
                newText: {
                  type: "string",
                  description: "The replacement text"
                }
              },
              required: ["oldText", "newText"]
            }
          },
          dryRun: {
            type: "boolean",
            description: "If true, just preview the changes without actually making them"
          }
        },
        required: ["path", "edits"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_file_info",
      description: "Get detailed metadata about a file or directory",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path to the file or directory"
          }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_allowed_directories",
      description: "List all directories that this server is allowed to access",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "describe_table",
      description: "Describe a database table's schema",
      parameters: {
        type: "object",
        properties: {
          table_name: {
            type: "string",
            description: "The fully qualified table name (e.g., schema.table_name)"
          }
        },
        required: ["table_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_tables",
      description: "List all tables in a specific schema",
      parameters: {
        type: "object",
        properties: {
          schema: {
            type: "string",
            description: "The schema name to list tables from"
          }
        },
        required: ["schema"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_schemas",
      description: "List all available schemas in a Databricks catalog",
      parameters: {
        type: "object",
        properties: {
          catalog: {
            type: "string",
            description: "The catalog name to list schemas from"
          }
        },
        required: ["catalog"]
      }
    }
  }
];

/**
 * デフォルトツールの取得
 * @returns デフォルトで使用可能なツールのリスト
 */
export function getDefaultTools() {
  return defaultTools;
}

/**
 * 特定のツールのみを取得
 * @param toolNames 取得するツールの名前の配列
 * @returns 指定したツールの定義のリスト
 */
export function getSelectedTools(toolNames: string[]) {
  return defaultTools.filter(tool => 
    toolNames.includes(tool.function.name)
  );
}

/**
 * ツール定義をOpenAIの形式に変換
 * @param tools ツール定義のリスト
 * @returns OpenAIのツール定義形式に変換されたリスト
 */
export function convertToolsToOpenAIFormat(tools: any[]) {
  return tools.map(tool => ({
    type: "function",
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters
    }
  }));
}

/**
 * ツール定義をDatabricksの形式に変換
 * @param tools ツール定義のリスト
 * @returns Databricksのツール定義形式に変換されたリスト
 */
export function convertToolsToDatabricksFormat(tools: any[]) {
  return tools.map(tool => {
    // Databricksのツール形式はOpenAIと同じ
    return {
      type: "function",
      function: {
        name: tool.function?.name || tool.name,
        description: tool.function?.description || tool.description,
        parameters: tool.function?.parameters || tool.parameters
      }
    };
  });
}

/**
 * ツール定義をClaudeの形式に変換
 * @param tools ツール定義のリスト
 * @returns Claudeのツール定義形式に変換されたリスト
 */
export function convertToolsToClaudeFormat(tools: any[]) {
  return tools.map(tool => {
    // Claudeの形式に変換 (type: functionはそのまま)
    return {
      type: "function",
      function: {
        name: tool.function?.name || tool.name,
        description: tool.function?.description || tool.description,
        parameters: tool.function?.parameters || tool.parameters
      }
    };
  });
}

/**
 * 利用可能なツールを全て取得して形式変換する
 * @param format 変換する形式 ("openai" | "databricks" | "claude")
 * @returns 指定した形式に変換されたツール定義のリスト
 */
export function getAllToolsInFormat(format: "openai" | "databricks" | "claude" = "openai") {
  if (format === "databricks") {
    return convertToolsToDatabricksFormat(defaultTools);
  } else if (format === "claude") {
    return convertToolsToClaudeFormat(defaultTools);
  } else {
    return convertToolsToOpenAIFormat(defaultTools);
  }
}