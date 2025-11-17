import { GetTool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";
import {
  executeCodePolicy,
  resolveCodeExecutionConfig,
} from "../policies/executeCodePolicy";

export const executeCodeTool: GetTool = ({ codeExecutionConfig }) => {
  const resolvedConfig = resolveCodeExecutionConfig(codeExecutionConfig);

  return {
    type: "function",
    displayTitle: "Execute Code",
    wouldLikeTo: "execute TypeScript code in the managed sandbox",
    isCurrently: "executing TypeScript code",
    hasAlready: "ran TypeScript code",
    readonly: false,
    group: BUILT_IN_GROUP_NAME,
    function: {
      name: BuiltInToolNames.ExecuteCode,
      description:
        "Execute TypeScript or JavaScript inside a persistent E2B sandbox. Use this for computations, simulations, and data wrangling that benefit from real code execution. The sandbox preserves state for the current conversation.",
      parameters: {
        type: "object",
        required: ["code"],
        properties: {
          code: {
            type: "string",
            description:
              "The TypeScript code to execute. Variables defined here remain available to subsequent calls in the same conversation.",
          },
          language: {
            type: "string",
            description:
              'Optional language override. Accepted values: "typescript" (default) or "javascript". Default: "typescript".',
            enum: ["typescript", "ts", "javascript", "js"],
            default: "typescript",
          },
        },
      },
    },
    defaultToolPolicy: "allowedWithoutPermission",
    evaluateToolCallPolicy: (
      basePolicy,
      _parsedArgs,
      _processedArgs,
      context,
    ) => {
      if (
        executeCodePolicy.shouldRequireConfirmation(
          context?.conversationId,
          resolvedConfig.requireFirstUseConfirmation,
        )
      ) {
        return "allowedWithPermission";
      }
      return basePolicy;
    },
    systemMessageDescription: {
      prefix: `Use ${BuiltInToolNames.ExecuteCode} when you truly need to run code. The sandbox persists state across calls, so initialize helpers once and reuse them.

**CRITICAL RULES:**
- NEVER use top-level \`return\` statements (syntax error)
- The last expression becomes the return value
- For async code, wrap in IIFE: \`(async () => { /* code */ })()\`
- Use \`globalThis\` for persistent state across calls

**Patterns:**

1. **Simple calculations** - Last expression is the return value:
   \`\`\`
   const bill = 87.5;
   const tip = bill * 0.15;
   console.log({ tip: tip.toFixed(2), total: (bill + tip).toFixed(2) });
   { tip, total: bill + tip };
   \`\`\`

2. **Async operations** - Wrap in IIFE with return:
   \`\`\`
   (async () => {
     const data = await fetchData();
     console.log("Result:", data);
     return { success: true, data };
   })();
   \`\`\`

3. **Persistent state** - Use globalThis:
   \`\`\`
   globalThis.history = globalThis.history || [];
   globalThis.history.push(42);
   globalThis.history.reduce((s, v) => s + v, 0);
   \`\`\`

4. **Error handling** - Try-catch in IIFE:
   \`\`\`
   (async () => {
     try {
       const result = await operation();
       return { success: true, result };
     } catch (error) {
       return { success: false, error: error.message };
     }
   })();
   \`\`\`

5. **Skip the tool** for trivial answers (e.g., respond "4" directly when asked "What is 2 + 2?").

**MCP Tools in Code Mode:**

All configured MCP tools are available as TypeScript modules at \`/mcp/{server-name}/\`:
- Type-safe function signatures generated automatically
- Progressive discovery via filesystem navigation
- Chain multiple tools in single code block for complex workflows

Example - Multi-step GitHub workflow:
\`\`\`
import { github } from '/mcp';

// Search, filter, and analyze in one execution
const repos = await github.searchRepositories({ query: 'typescript' });
const topRepo = repos.sort((a, b) => b.stars - a.stars)[0];
const issues = await github.listIssues({
  owner: topRepo.owner,
  repo: topRepo.name
});

// Filter large datasets IN CODE (not in context) - saves tokens!
const bugs = issues.filter(i => i.labels.includes('bug'));
const highPriority = bugs.filter(i => i.labels.includes('priority:high'));

console.log(\`\${topRepo.name}: \${highPriority.length}/\${bugs.length} high-priority bugs\`);
{ repo: topRepo.name, bugs: bugs.length, highPriority: highPriority.length };
\`\`\`

Discover available MCP tools:
\`\`\`
import fs from 'fs';
const servers = fs.readdirSync('/mcp');
console.log('MCP servers:', servers); // e.g., ['github', 'google-drive', ...]

// Inspect specific server's tools
const tools = fs.readdirSync('/mcp/github');
console.log('GitHub tools:', tools); // e.g., ['createIssue.ts', 'searchRepos.ts', ...]
\`\`\`

**When to use Code Mode vs. Direct Tool Calls:**
- Direct tools: Single, simple operations (e.g., "search GitHub for repo X")
- Code Mode: Multi-step workflows, data filtering, complex orchestration (e.g., "find all open bugs, filter by priority, create summary report")`,
      exampleArgs: [
        [
          "code",
          "const samples = [12, 18, 6];\nconst average = samples.reduce((sum, value) => sum + value, 0) / samples.length;\nconsole.log(`Average: ${average}`);\naverage;",
        ],
        [
          "code",
          "import { github } from '/mcp';\nconst issues = await github.listIssues({ state: 'open' });\nconst bugs = issues.filter(i => i.labels.includes('bug'));\nconsole.log(`Found ${bugs.length} bugs out of ${issues.length} total issues`);\n{ total: issues.length, bugs: bugs.length };",
        ],
      ],
    },
  };
};
