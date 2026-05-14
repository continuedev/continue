import { services } from "../services/index.js";

import { Tool } from "./types.js";

type SearchableTool = {
  name: string;
  description: string;
};

function parseToolName(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function scoreTool(tool: SearchableTool, queryTerms: string[]): number {
  const nameTerms = parseToolName(tool.name);
  const description = tool.description.toLowerCase();
  let score = 0;

  for (const term of queryTerms) {
    const required = term.startsWith("+");
    const normalized = required ? term.slice(1) : term;
    const exactName = nameTerms.includes(normalized);
    const partialName = nameTerms.some((nameTerm) =>
      nameTerm.includes(normalized),
    );
    const descriptionMatch = description.includes(normalized);

    if (required && !exactName && !partialName && !descriptionMatch) {
      return 0;
    }

    if (exactName) {
      score += 10;
    } else if (partialName) {
      score += 5;
    }

    if (descriptionMatch) {
      score += 2;
    }
  }

  return score;
}

export const toolSearchTool: Tool = {
  name: "ToolSearch",
  displayName: "ToolSearch",
  description:
    "Search available tools by keyword or inspect a specific tool by exact name.",
  readonly: true,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["query"],
    properties: {
      query: {
        type: "string",
        description:
          'Use keywords like "grep task mcp", or "select:ToolSearch,Grep" for exact lookup.',
      },
      max_results: {
        type: "number",
        description: "Maximum number of results to return. Defaults to 5.",
      },
    },
  },
  run: async (args: {
    query: string;
    max_results?: number;
  }): Promise<string> => {
    const { getAllAvailableTools } = await import("./index.js");
    const tools = await getAllAvailableTools(!process.stdout.isTTY);
    const query = args.query.trim();
    const maxResults = Math.max(1, args.max_results ?? 5);

    if (!query) {
      throw new Error("query is required");
    }

    if (query.startsWith("select:")) {
      const names = query
        .slice("select:".length)
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);

      const matches = tools.filter((tool) => names.includes(tool.name));

      if (matches.length === 0) {
        return `No tools found for: ${names.join(", ")}`;
      }

      return matches
        .map(
          (tool) =>
            `${tool.name}\n${tool.description}\nParameters: ${JSON.stringify(tool.parameters, null, 2)}`,
        )
        .join("\n\n---\n\n");
    }

    const searchableTools: SearchableTool[] = [
      ...tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
      })),
      ...services.mcp.getState().tools.map((tool) => ({
        name: tool.name,
        description: tool.description ?? "",
      })),
    ];

    const dedupedTools = Array.from(
      new Map(searchableTools.map((tool) => [tool.name, tool])).values(),
    );

    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = dedupedTools
      .map((tool) => ({ tool, score: scoreTool(tool, queryTerms) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, maxResults)
      .map(({ tool }) => tool);

    if (matches.length === 0) {
      return `No tools matched "${query}".`;
    }

    return [
      `Found ${matches.length} tool(s):`,
      ...matches.map((tool) => `- ${tool.name}: ${tool.description}`),
      "",
      "Use select:<tool-name> to inspect a tool schema.",
    ].join("\n");
  },
};
