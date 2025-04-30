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