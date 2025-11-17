/**
 * Advanced Example 6: LSP-Powered Code Navigation
 *
 * Task: Analyze a codebase function to understand its usage and dependencies
 *
 * Traditional approach: Grep/search, manual file reading - ~50K tokens
 * With LSP: Precise navigation, type-aware analysis - ~2K tokens
 * Token Reduction: 96%
 */

import { lsp } from "/mcp";

// Configuration: Analyze the 'executeCodeImpl' function
const TARGET_FILE = "/workspace/core/tools/implementations/executeCode.ts";
const TARGET_FUNCTION_LINE = 522; // Line where executeCodeImpl is defined
const TARGET_FUNCTION_CHARACTER = 13; // Character position of function name

console.log("🔍 Starting LSP-powered code analysis...\n");

// ============================================================================
// 1. Get Definition and Type Information
// ============================================================================

console.log("📍 Step 1: Getting function definition and type info...");

const definitions = await lsp.getDefinition({
  filepath: TARGET_FILE,
  line: TARGET_FUNCTION_LINE,
  character: TARGET_FUNCTION_CHARACTER,
});

if (definitions.length === 0) {
  throw new Error("Function definition not found");
}

const definition = definitions[0];
console.log(
  `✓ Found definition at ${definition.filepath}:${definition.range.start.line}`,
);
console.log(
  `  Preview:\n${definition.contents.split("\n").slice(0, 5).join("\n")}\n`,
);

// Get hover information for detailed type info
const hoverInfo = await lsp.getHover({
  filepath: TARGET_FILE,
  line: TARGET_FUNCTION_LINE,
  character: TARGET_FUNCTION_CHARACTER,
});

if (hoverInfo) {
  console.log("📖 Type Information:");
  console.log(hoverInfo.contents);
  console.log();
}

// ============================================================================
// 2. Find All References (Usage Sites)
// ============================================================================

console.log("🔗 Step 2: Finding all references to this function...");

const references = await lsp.findReferences({
  filepath: definition.filepath,
  line: definition.range.start.line,
  character: definition.range.start.character,
  includeDeclaration: false,
});

console.log(`✓ Found ${references.length} references across the codebase:`);
const referencesByFile = references.reduce(
  (acc, ref) => {
    acc[ref.filepath] = (acc[ref.filepath] || 0) + 1;
    return acc;
  },
  {} as Record<string, number>,
);

for (const [file, count] of Object.entries(referencesByFile)) {
  console.log(`  - ${file}: ${count} reference${count > 1 ? "s" : ""}`);
}
console.log();

// ============================================================================
// 3. Analyze File for Errors/Warnings
// ============================================================================

console.log("⚠️  Step 3: Checking for compiler diagnostics...");

const diagnostics = await lsp.getDiagnostics({
  filepath: TARGET_FILE,
});

const errors = diagnostics.filter((d) => d.severity === 0);
const warnings = diagnostics.filter((d) => d.severity === 1);
const info = diagnostics.filter((d) => d.severity === 2);

console.log(`✓ Diagnostics summary:`);
console.log(`  - Errors: ${errors.length}`);
console.log(`  - Warnings: ${warnings.length}`);
console.log(`  - Info: ${info.length}`);

if (errors.length > 0) {
  console.log("\n  📋 Errors:");
  for (const error of errors.slice(0, 5)) {
    console.log(`    Line ${error.range.start.line + 1}: ${error.message}`);
  }
}
console.log();

// ============================================================================
// 4. Get Document Symbols (File Structure)
// ============================================================================

console.log("📊 Step 4: Analyzing file structure...");

const symbols = await lsp.getDocumentSymbols({
  filepath: TARGET_FILE,
});

// Symbol kinds: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#symbolKind
const symbolKindNames: Record<number, string> = {
  1: "File",
  2: "Module",
  3: "Namespace",
  4: "Package",
  5: "Class",
  6: "Method",
  7: "Property",
  8: "Field",
  9: "Constructor",
  10: "Enum",
  11: "Interface",
  12: "Function",
  13: "Variable",
  14: "Constant",
  15: "String",
  16: "Number",
  17: "Boolean",
  18: "Array",
  19: "Object",
  20: "Key",
  21: "Null",
  22: "EnumMember",
  23: "Struct",
  24: "Event",
  25: "Operator",
  26: "TypeParameter",
};

const symbolsByKind = symbols.reduce(
  (acc, sym) => {
    const kind = symbolKindNames[sym.kind] || `Unknown(${sym.kind})`;
    acc[kind] = (acc[kind] || 0) + 1;
    return acc;
  },
  {} as Record<string, number>,
);

console.log("✓ File structure:");
for (const [kind, count] of Object.entries(symbolsByKind)) {
  console.log(`  - ${kind}: ${count}`);
}

// Find classes in the file
const classes = symbols.filter((s) => s.kind === 5);
console.log(`\n  📦 Classes in file:`);
for (const cls of classes) {
  console.log(`    - ${cls.name} (line ${cls.range.start.line + 1})`);
}
console.log();

// ============================================================================
// 5. Search Workspace for Related Symbols
// ============================================================================

console.log("🔎 Step 5: Searching workspace for related symbols...");

// Search for all tools in the workspace
const toolSymbols = await lsp.getWorkspaceSymbols({
  query: "Tool",
});

console.log(
  `✓ Found ${toolSymbols.length} symbols matching "Tool" in workspace`,
);

// Group by file
const toolsByFile = toolSymbols.reduce(
  (acc, sym) => {
    acc[sym.filepath] = (acc[sym.filepath] || 0) + 1;
    return acc;
  },
  {} as Record<string, number>,
);

console.log(`  Distributed across ${Object.keys(toolsByFile).length} files:`);
for (const [file, count] of Object.entries(toolsByFile).slice(0, 5)) {
  console.log(`    - ${file}: ${count} symbol${count > 1 ? "s" : ""}`);
}
console.log();

// ============================================================================
// 6. Generate Analysis Report
// ============================================================================

console.log("📝 Generating analysis report...\n");

const report = {
  function: {
    name: "executeCodeImpl",
    file: TARGET_FILE,
    line: TARGET_FUNCTION_LINE + 1,
  },
  usage: {
    totalReferences: references.length,
    filesUsingIt: Object.keys(referencesByFile).length,
    mostUsedIn: Object.entries(referencesByFile).sort(
      ([, a], [, b]) => b - a,
    )[0],
  },
  codeQuality: {
    errors: errors.length,
    warnings: warnings.length,
    hasIssues: errors.length > 0 || warnings.length > 0,
  },
  fileStructure: {
    totalSymbols: symbols.length,
    classes: classes.length,
    symbolBreakdown: symbolsByKind,
  },
  relatedSymbols: {
    toolReferences: toolSymbols.length,
    toolFiles: Object.keys(toolsByFile).length,
  },
};

console.log("📊 Analysis Report:");
console.log(JSON.stringify(report, null, 2));

// ============================================================================
// 7. Token Comparison
// ============================================================================

console.log("\n💡 Token Usage Comparison:\n");

const traditionalApproach = `
Traditional approach (without LSP):
1. Grep for function name: ~100 files returned
2. Read each file to find exact location: ~50,000 tokens
3. Manual search for references: grep entire codebase
4. Read all reference files: ~100,000 tokens
5. Run tsc to get errors: parse complex output
6. Manual symbol extraction: read and parse files

Total: ~150,000+ tokens, multiple round-trips
`;

const lspApproach = `
LSP approach:
1. getDefinition: Returns exact location + code snippet (~500 tokens)
2. findReferences: Returns precise locations (~300 tokens)
3. getDiagnostics: Returns structured errors (~200 tokens)
4. getDocumentSymbols: Returns file structure (~500 tokens)
5. getWorkspaceSymbols: Returns symbol matches (~500 tokens)

Total: ~2,000 tokens, single execution
`;

console.log(traditionalApproach);
console.log(lspApproach);

console.log("🎯 Result: 98.7% token reduction!\n");

// ============================================================================
// Return structured data for further processing
// ============================================================================

export default report;

/*
 * 🌟 Key Takeaways:
 *
 * 1. PRECISION: LSP provides exact locations, not fuzzy search results
 * 2. TYPE-AWARE: Understands code structure, not just text matching
 * 3. EFFICIENT: ~2K tokens vs ~150K tokens for same analysis
 * 4. COMPREHENSIVE: Definitions, references, diagnostics, symbols - all in one
 * 5. COMPOSABLE: Combine LSP with other MCP tools (GitHub, file ops, etc.)
 *
 * Use Cases:
 * - Code review: Find all usages before refactoring
 * - Documentation: Auto-generate API docs with type info
 * - Debugging: Find error locations with diagnostics
 * - Migration: Track down all references when changing APIs
 * - Analytics: Understand codebase structure and dependencies
 */
