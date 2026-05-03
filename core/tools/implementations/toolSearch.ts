import { Tool } from "../..";
import { ToolImpl } from ".";

// ─── Name parsing ─────────────────────────────────────────────────────────────

type ParsedName = { parts: string[]; full: string; isMcp: boolean };

function parseToolName(name: string): ParsedName {
  if (name.startsWith("mcp__")) {
    const withoutPrefix = name.replace(/^mcp__/, "").toLowerCase();
    const parts = withoutPrefix.split("__").flatMap((p) => p.split("_"));
    return {
      parts: parts.filter(Boolean),
      full: withoutPrefix.replace(/__/g, " ").replace(/_/g, " "),
      isMcp: true,
    };
  }
  // CamelCase or underscore_case → split into lowercase parts
  const parts = name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return { parts, full: name.toLowerCase(), isMcp: false };
}

// ─── Term pattern compilation ─────────────────────────────────────────────────

function compileTermPatterns(terms: string[]): Map<string, RegExp> {
  const map = new Map<string, RegExp>();
  for (const term of terms) {
    // Escape special regex chars, then add word-boundary anchors where possible
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    map.set(term, new RegExp(`\\b${escaped}`, "i"));
  }
  return map;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreToolAgainstQuery(
  parsed: ParsedName,
  description: string,
  queryTerms: string[],
  requiredTerms: string[],
  termPatterns: Map<string, RegExp>,
): number {
  const descLower = description.toLowerCase();
  const allTerms = [...requiredTerms, ...queryTerms.filter((t) => !t.startsWith("+"))];

  // Check all required terms are satisfied
  for (const req of requiredTerms) {
    const pattern = termPatterns.get(req)!;
    const nameMatch =
      parsed.parts.includes(req) ||
      parsed.parts.some((p) => p.includes(req)) ||
      parsed.full.includes(req);
    if (!nameMatch && !pattern.test(descLower)) {
      return 0; // Required term not found — exclude
    }
  }

  let score = 0;
  for (const term of allTerms) {
    const pattern = termPatterns.get(term)!;

    if (parsed.parts.includes(term)) {
      score += parsed.isMcp ? 12 : 10; // Exact name-part match
    } else if (parsed.parts.some((p) => p.includes(term))) {
      score += parsed.isMcp ? 6 : 5; // Partial name-part match
    } else if (parsed.full.includes(term) && score === 0) {
      score += 3; // Full-name fallback
    }

    if (pattern.test(descLower)) {
      score += 2; // Description match
    }
  }
  return score;
}

// ─── Select: direct lookup ────────────────────────────────────────────────────

function handleSelectQuery(
  rawNames: string[],
  tools: Tool[],
): { name: string; description: string; parameters?: unknown }[] {
  const results: { name: string; description: string; parameters?: unknown }[] = [];
  for (const targetName of rawNames) {
    const tool = tools.find(
      (t) => t.function.name.toLowerCase() === targetName.toLowerCase().trim(),
    );
    if (tool) {
      results.push({
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      });
    }
  }
  return results;
}

// ─── Keyword search ───────────────────────────────────────────────────────────

function handleKeywordQuery(
  query: string,
  tools: Tool[],
  maxResults: number,
): { name: string; description: string }[] {
  const queryLower = query.toLowerCase().trim();

  // Fast path: exact name match
  const exact = tools.find(
    (t) => t.function.name.toLowerCase() === queryLower,
  );
  if (exact) {
    return [{ name: exact.function.name, description: exact.function.description }];
  }

  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 0);
  const requiredTerms = queryTerms
    .filter((t) => t.startsWith("+") && t.length > 1)
    .map((t) => t.slice(1));
  const optionalTerms = queryTerms.filter((t) => !t.startsWith("+"));
  const allScoringTerms = [...requiredTerms, ...optionalTerms];
  const termPatterns = compileTermPatterns(allScoringTerms);

  const scored = tools
    .map((tool) => ({
      tool,
      score: scoreToolAgainstQuery(
        parseToolName(tool.function.name),
        tool.function.description,
        optionalTerms,
        requiredTerms,
        termPatterns,
      ),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return scored.map(({ tool }) => ({
    name: tool.function.name,
    description: tool.function.description,
  }));
}

// ─── Tool implementation ──────────────────────────────────────────────────────

export const toolSearchImpl: ToolImpl = async (args, extras) => {
  const query: string =
    typeof args?.query === "string" ? args.query.trim() : "";
  const maxResults: number =
    typeof args?.max_results === "number" && args.max_results > 0
      ? args.max_results
      : 5;

  if (!query) {
    return [
      {
        name: "Tool Search Error",
        description: "Missing query",
        content: "The `query` argument is required.",
      },
    ];
  }

  // Gather all tools currently available (passed via extras.availableTools if
  // present, otherwise fall back to the extras.config tool definitions).
  const allTools: Tool[] =
    (extras as any).availableTools ??
    ((extras as any).tools as Tool[] | undefined) ??
    [];

  // ── select: exact lookup ──────────────────────────────────────────────────
  if (query.startsWith("select:")) {
    const names = query.slice("select:".length).split(",");
    const results = handleSelectQuery(names, allTools);

    if (results.length === 0) {
      return [
        {
          name: "Tool Search",
          description: "No matching tools found",
          content: `No tools found matching names: ${names.join(", ")}.\n\nAvailable tools:\n${allTools.map((t) => `- ${t.function.name}`).join("\n")}`,
        },
      ];
    }

    const content = results
      .map(
        (r) =>
          `## ${r.function?.name ?? r.name}\n${r.description}\n${
            r.parameters
              ? `\nParameters:\n\`\`\`json\n${JSON.stringify(r.parameters, null, 2)}\n\`\`\``
              : ""
          }`,
      )
      .join("\n\n---\n\n");

    return [
      {
        name: "Tool Search Results",
        description: `${results.length} tool(s) found`,
        content,
      },
    ];
  }

  // ── keyword search ────────────────────────────────────────────────────────
  const matches = handleKeywordQuery(query, allTools, maxResults);

  if (matches.length === 0) {
    return [
      {
        name: "Tool Search",
        description: "No matching tools found",
        content: `No tools matched "${query}".\n\nAvailable tools:\n${allTools.map((t) => `- ${t.function.name}`).join("\n")}`,
      },
    ];
  }

  const content = [
    `Found ${matches.length} tool(s) matching "${query}" (${allTools.length} total available):`,
    "",
    ...matches.map((m) => `- **${m.name}**: ${m.description}`),
    "",
    'Use `select:<name>` to get the full parameter schema for a specific tool.',
  ].join("\n");

  return [
    {
      name: "Tool Search Results",
      description: `${matches.length}/${allTools.length} tools match "${query}"`,
      content,
    },
  ];
};
