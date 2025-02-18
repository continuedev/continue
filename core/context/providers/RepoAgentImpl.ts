import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { StateGraph } from "@langchain/langgraph";
import { MemorySaver, Annotation, messagesStateReducer } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ToolCall as LangChainToolCall } from "@langchain/core/messages/tool";
import * as path from "node:path";
import { IDE, ChatMessage, Tool, ToolCall as ContinueToolCall } from "../../index.js";
import { z } from "zod";
import { ConfigHandler } from "../../config/ConfigHandler.js";
import { ControlPlaneClient } from "../../control-plane/client.js";

// System prompt template for the repository agent
const systemPrompt = `You are a knowledgeable and helpful repository agent, designed to assist users in understanding and working with codebases.

WORKSPACE INFORMATION:
- Your workspace root is: {{WORKSPACE_ROOT}}
- All file paths should be relative to this workspace root
- You have direct access to all files in this workspace
- When using tools, always use relative paths (e.g., "src/main.ts" not "{{WORKSPACE_ROOT}}/src/main.ts")
- Start exploring from the root directory using: <list_dir><dirpath>.</dirpath></list_dir>

ROLE:
- You are an expert in code analysis, repository navigation, and code modification
- You aim to provide accurate, detailed, and actionable responses
- You maintain a professional and helpful demeanor
- You MUST use the available tools to gather information before responding

TOOL USE FORMATTING:
Tool uses are formatted using XML-style tags. The tool name is enclosed in opening and closing tags, and each parameter is similarly enclosed within its own set of tags. Here's the structure:

<tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</tool_name>

For example:
<search_code>
<query>function handleError</query>
</search_code>

TOOL USAGE GUIDELINES:
1. DO NOT repeat the same tool call with the same parameters
2. If a search returns unexpected results, try different search terms or use a different tool
3. When searching for files:
   - Use list_dir first to understand the directory structure
   - Use more specific search terms (e.g., "export class MyComponent" instead of just "MyComponent")
   - For README files, try searching for "# Project Title" or similar markdown headers
4. When a tool call doesn't give expected results:
   - Analyze the results to understand why
   - Try a different approach
   - Use a combination of tools (e.g., list_dir + read_file)

AVAILABLE TOOLS:
1. search_code: Perform text-based search across the codebase to find relevant code snippets. The search is based on exact text matching, so use specific terms, function names, variable names, or code patterns that you expect to find in the code.
   Examples:
   <search_code>
   <query>export class SearchContextProvider</query>
   </search_code>
   
   <search_code>
   <query>function getSearchResults</query>
   </search_code>
   
   <search_code>
   <query>export function handleError</query>
   </search_code>
   
   <search_code>
   <query># Project Title</query>
   </search_code>

2. read_file: Read the contents of specific files
   Example:
   <read_file>
   <filepath>src/main.ts</filepath>
   </read_file>

3. edit_file: Modify or create files in the repository
   Example:
   <edit_file>
   <filepath>src/utils.ts</filepath>
   <content>// New file content here</content>
   </edit_file>

4. list_dir: List the contents of a directory
   Example:
   <list_dir>
   <dirpath>.</dirpath>
   </list_dir>

5. get_problems: Get diagnostic problems for files
   Example:
   <get_problems>
   <filepath>src/index.ts</filepath>
   </get_problems>

WORKFLOW GUIDELINES:
1. Start with list_dir to understand the project structure
2. When looking for project information:
   - First list the root directory to find README and config files
   - If not found, try searching for markdown headers or package definitions
   - Use read_file on found files
3. Never make assumptions without checking the code first
4. Provide explanations based on actual code, not assumptions

RESPONSE LANGUAGE:
- Match your response language to the user's query language
- Use English for code, comments, and technical terms
- Maintain consistent formatting and clear structure

IMPORTANT: 
- You MUST actively and efficiently use the tools to gather information before responding
- DO NOT repeat the same tool call if it didn't give expected results
- If a tool call doesn't work as expected, try a different approach
- Respond as quickly and concise as possible`;

// Get workspace root from IDE interface
async function getWorkspaceRoot(ide: IDE): Promise<string> {
  const workspaceDirs = await ide.getWorkspaceDirs();
  return workspaceDirs[0] || process.cwd();
}

// Define the graph state for managing conversation history
const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
  }),
});

// Create tools using the provided IDE instance
async function createTools(ide: IDE) {
  const workspaceRoot = await getWorkspaceRoot(ide);

  const searchCodeTool = tool(async (args) => {
    const { query } = z.object({ query: z.string() }).parse(args);
    try {
      const results = await ide.getSearchResults(query);
      return results;
    } catch (error: any) {
      return `Error searching code: ${error.message}`;
    }
  }, {
    name: "search_code",
    description: "Search for relevant code in the repository using semantic search.",
    schema: {
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "The search query to find relevant code."
        }
      }
    }
  });

  const readFileTool = tool(async (args) => {
    const { filepath } = z.object({ filepath: z.string() }).parse(args);
    try {
      const content = await ide.readFile(path.join(workspaceRoot, filepath));
      return content;
    } catch (error: any) {
      return `Error reading file: ${error.message}`;
    }
  }, {
    name: "read_file",
    description: "Read the contents of a file in the repository.",
    schema: {
      type: "object",
      required: ["filepath"],
      properties: {
        filepath: {
          type: "string",
          description: "The relative path to the file from workspace root."
        }
      }
    }
  });

  const editFileTool = tool(async (args) => {
    const { filepath, content } = z.object({ 
      filepath: z.string(),
      content: z.string()
    }).parse(args);
    try {
      await ide.writeFile(path.join(workspaceRoot, filepath), content);
      return `Successfully edited file: ${filepath}`;
    } catch (error: any) {
      return `Error editing file: ${error.message}`;
    }
  }, {
    name: "edit_file",
    description: "Edit or create a file in the repository.",
    schema: {
      type: "object",
      required: ["filepath", "content"],
      properties: {
        filepath: {
          type: "string",
          description: "The relative path to the file from workspace root."
        },
        content: {
          type: "string",
          description: "The new content to write to the file."
        }
      }
    }
  });

  const listDirTool = tool(async (args) => {
    const { dirpath } = z.object({ dirpath: z.string() }).parse(args);
    try {
      const entries = await ide.listDir(path.join(workspaceRoot, dirpath));
      return JSON.stringify(entries.map(([name, type]) => ({
        name,
        type: type === 2 ? "directory" : "file"
      })), null, 2);
    } catch (error: any) {
      return `Error listing directory: ${error.message}`;
    }
  }, {
    name: "list_dir",
    description: "List the contents of a directory in the repository.",
    schema: {
      type: "object",
      required: ["dirpath"],
      properties: {
        dirpath: {
          type: "string",
          description: "The relative path to the directory from workspace root."
        }
      }
    }
  });

  const getProblems = tool(async (args) => {
    const { filepath } = z.object({ filepath: z.string().optional() }).parse(args);
    try {
      const problems = await ide.getProblems(filepath);
      return JSON.stringify(problems, null, 2);
    } catch (error: any) {
      return `Error getting problems: ${error.message}`;
    }
  }, {
    name: "get_problems",
    description: "Get diagnostic problems (errors, warnings) for a file.",
    schema: {
      type: "object",
      properties: {
        filepath: {
          type: "string",
          description: "Optional file path to get problems for. If not provided, gets problems for the current file."
        }
      }
    }
  });

  return [searchCodeTool, readFileTool, editFileTool, listDirTool, getProblems];
}

// Create model instance with the provided tools and IDE
async function createModel(tools: any[], ide: IDE, modelTitle?: string) {
  const ideSettings = {
    telemetryEnabled: false,
    remoteConfigServerUrl: "",
    userToken: "",
    remoteConfigSyncPeriod: 60,
    pauseCodebaseIndexOnStart: false,
    pauseTabAutocompleteOnBattery: false,
    enableControlServerBeta: false,
    continueTestEnvironment: "none" as "none" | "production" | "local" | "staging",
  };

  const configHandler = new ConfigHandler(
    ide,
    Promise.resolve(ideSettings),
    async () => {},
    new ControlPlaneClient(
      Promise.resolve(undefined),
      Promise.resolve(ideSettings)
    )
  );

  // Use provided model title or fallback to environment variable
  const title = modelTitle || process.env.CONTINUE_MODEL_TITLE;
  if (!title) {
    throw new Error("Model title is required for Continue provider");
  }
  const llm = await configHandler.llmFromTitle(title);
  
  // Adapt Continue model interface to LangChain interface
  return {
    invoke: async (messages: BaseMessage[]) => {
      try {
        if (!messages || messages.length === 0) {
          throw new Error("At least one message is required");
        }

        // Convert BaseMessage[] to ChatMessage[]
        const chatMessages: ChatMessage[] = messages.map(msg => {
          const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
          if (!content) {
            throw new Error("Message content cannot be empty");
          }
          if (msg instanceof SystemMessage) {
            return { role: "system", content };
          } else if (msg instanceof HumanMessage) {
            return { role: "user", content };
          } else if (msg instanceof AIMessage) {
            return { role: "assistant", content, tool_calls: msg.tool_calls };
          } else if (msg instanceof ToolMessage) {
            return { role: "tool", content, toolCallId: msg.tool_call_id };
          } else {
            throw new Error(`Unsupported message type: ${msg.constructor.name}`);
          }
        });

        console.log("Sending chat messages to model:", chatMessages);
        
        // Use chat method instead of invoke
        const response = await llm.chat(chatMessages, new AbortController().signal, {
          tools: tools.map(t => ({
            type: "function" as const,
            function: {
              name: t.name,
              description: t.description,
              parameters: {
                type: "object",
                properties: t.schema.shape,
                required: Object.keys(t.schema.shape)
              }
            },
            displayTitle: t.name,
            wouldLikeTo: `I would like to ${t.description}`,
            readonly: false
          } as Tool))
        });

        if (!response) {
          throw new Error("Empty response from model");
        }

        // Process response content
        let content = "";
        let toolCalls: ContinueToolCall[] | undefined;

        // First check for native tool calls
        if ('tool_calls' in response && Array.isArray(response.tool_calls)) {
          toolCalls = response.tool_calls.map(call => convertLangChainToolCallToContinue(call as LangChainToolCall));
        }

        // If there's response content, try to parse XML tool calls
        if (response.content) {
          content = typeof response.content === "string" ? 
            response.content : 
            JSON.stringify(response.content);

          if (!toolCalls) {
            const xmlToolCalls = parseToolCalls(content);
            if (xmlToolCalls.length > 0) {
              toolCalls = convertToToolCalls(xmlToolCalls);
            }
          }
        }

        // Ensure response has either content or tool calls
        if (!content && !toolCalls) {
          throw new Error("Response must contain either content or tool calls");
        }
        
        return new AIMessage({ 
          content,
          tool_calls: toolCalls ? toolCalls.map(convertContinueToolCallToLangChain) : undefined
        });
      } catch (error) {
        console.error("Error in model.invoke:", error);
        throw error;
      }
    }
  };
}

// Helper function to parse XML tool calls from model response
function parseToolCalls(content: string): { toolName: string; params: Record<string, string> }[] {
  const toolCalls: { toolName: string; params: Record<string, string> }[] = [];
  
  // Match tool call blocks
  const toolBlockRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
  const toolMatches = content.matchAll(toolBlockRegex);
  
  for (const match of toolMatches) {
    const toolName = match[1];
    const paramsContent = match[2];
    
    // Match parameter blocks within tool call
    const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    const paramMatches = paramsContent.matchAll(paramRegex);
    
    const params: Record<string, string> = {};
    for (const paramMatch of paramMatches) {
      params[paramMatch[1]] = paramMatch[2].trim();
    }
    
    toolCalls.push({ toolName, params });
  }
  
  return toolCalls;
}

// Convert Continue ToolCall to LangChain ToolCall format
function convertContinueToolCallToLangChain(call: ContinueToolCall): LangChainToolCall {
  return {
    id: call.id || `call_${Date.now()}`,
    type: "tool_call",
    name: call.function.name,
    args: JSON.parse(call.function.arguments)
  };
}

// Convert LangChain ToolCall to Continue ToolCall format
function convertLangChainToolCallToContinue(call: LangChainToolCall): ContinueToolCall {
  return {
    id: call.id || `call_${Date.now()}`,
    type: "function",
    function: {
      name: call.name,
      arguments: JSON.stringify(call.args)
    }
  };
}

// Convert XML tool calls to Continue ToolCall format
function convertToToolCalls(xmlToolCalls: { toolName: string; params: Record<string, string> }[]): ContinueToolCall[] {
  return xmlToolCalls.map((call, index) => ({
    id: `call_${index}`,
    type: "function",
    function: {
      name: call.toolName,
      arguments: JSON.stringify(call.params)
    }
  }));
}

// Determine whether to continue processing based on message content
function shouldContinue(state: typeof StateAnnotation.State) {
  const messages = state.messages;
  if (messages.length === 0) return "__end__";
  
  const lastMessage = messages[messages.length - 1];
  
  if (lastMessage instanceof AIMessage) {
    // Check for tool calls
    if (lastMessage.tool_calls?.length) {
      return "tools";
    }
    
    // Check for XML format tool calls
    const content = lastMessage.content as string;
    if (content) {
      const xmlToolCalls = parseToolCalls(content);
      if (xmlToolCalls.length > 0) {
        // Convert to LangChain format and update message
        const continueToolCalls = convertToToolCalls(xmlToolCalls);
        lastMessage.tool_calls = continueToolCalls.map(convertContinueToolCallToLangChain);
        return "tools";
      }
    }
  }
  
  return "__end__";
}

// Define the function that calls the model and processes responses
function createCallModel(model: any) {
  return async function callModel(state: typeof StateAnnotation.State) {
    const messages = state.messages;
    try {
      if (!messages || messages.length === 0) {
        throw new Error("At least one message is required");
      }

      // Filter out empty messages but keep tool-related messages
      const validMessages = messages.filter(msg => {
        if (msg instanceof AIMessage && msg.tool_calls?.length) {
          return true;
        }
        return msg.content !== undefined && msg.content !== null && msg.content !== "";
      });

      if (validMessages.length === 0) {
        throw new Error("No valid messages found");
      }

      console.log("Sending messages to model:", validMessages.map(m => ({
        type: m.constructor.name,
        content: m.content,
        tool_calls: m instanceof AIMessage ? m.tool_calls : undefined
      })));

      const response = await model.invoke(validMessages);
      
      if (!response) {
        throw new Error("Empty response from model");
      }

      // Parse tool calls from response
      const content = response.content || "";
      const xmlToolCalls = parseToolCalls(content);
      
      if (xmlToolCalls.length > 0) {
        // Convert to Continue format
        const continueToolCalls = convertToToolCalls(xmlToolCalls);
        
        // Create a new message with original content and tool calls
        const toolCallMessage = new AIMessage({
          content: content,
          tool_calls: continueToolCalls.map(convertContinueToolCallToLangChain)
        });

        // Return message with tool calls
        return { messages: [...state.messages, toolCallMessage] };
      }

      // If no tool calls, return original response
      return { messages: [...state.messages, response] };
    } catch (error) {
      console.error("Error in callModel:", error);
      throw error;
    }
  };
}

// Handle repository agent messages from VSCode extension
export async function handleRepoAgentMessage(message: { type: string; payload: any }, ide: IDE) {
  if (message.type === "INVOKE_REPO_AGENT") {
    try {
      console.log("Received user input:", message.payload.input);
      if (!message.payload.input || typeof message.payload.input !== "string") {
        throw new Error("Invalid input: input must be a non-empty string");
      }
      
      const agent = await initRepoAgent(ide);
      const result = await agent.invoke(message.payload.input);
      return {
        type: "REPO_AGENT_RESPONSE",
        payload: {
          messages: result.messages
        }
      };
    } catch (error: any) {
      console.error("Repository Agent error:", error);
      return {
        type: "REPO_AGENT_ERROR",
        payload: {
          error: error.message
        }
      };
    }
  }
  return null;
}

// Initialize repository agent with IDE instance and optional model title
export async function initRepoAgent(ide: IDE, modelTitle?: string) {
  const workspaceRoot = await getWorkspaceRoot(ide);
  console.log("Workspace root:", workspaceRoot);

  const tools = await createTools(ide);
  const toolNode = new ToolNode(tools);
  const model = await createModel(tools, ide, modelTitle);
  const callModel = createCallModel(model);

  // Define the graph for managing conversation flow
  const workflow = new StateGraph(StateAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  // Initialize memory for conversation state
  const checkpointer = new MemorySaver();

  // Compile the graph
  const app = workflow.compile({ checkpointer });

  return {
    async invoke(input: string) {
      console.log("Starting conversation with input:", input);
      
      if (!input || typeof input !== "string") {
        throw new Error("Invalid input: input must be a non-empty string");
      }

      const messages = [
        new SystemMessage(systemPrompt.replace(/\${{WORKSPACE_ROOT}}/g, workspaceRoot)),
        new HumanMessage(input)
      ];

      console.log("Initial messages:", messages.map(m => ({
        type: m.constructor.name,
        content: m.content
      })));
      
      const finalState = await app.invoke(
        { messages },
        { configurable: { thread_id: "repo-agent-1" } }
      ) as typeof StateAnnotation.State;

      // Log conversation history for debugging
      console.log("\nConversation history:");
      finalState.messages.forEach((msg, i) => {
        console.log(`Message ${i + 1}:`);
        console.log("Type:", msg.constructor.name);
        console.log("Content:", msg.content);
      });

      return finalState;
    }
  };
}
