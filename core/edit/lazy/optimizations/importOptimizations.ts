import { DiffLine } from "../../..";
import { deterministicApplyLazyEdit } from "../deterministicLazyEdit";

/**
 * Optimizations for TypeScript/JavaScript import statements
 * Handles adding, removing, reorganizing, and updating imports
 */

interface ImportStatement {
  type: "default" | "named" | "namespace" | "side_effect" | "type_only";
  source: string; // Module path/name
  defaultImport?: string; // Default import name
  namedImports: string[]; // Named imports
  namespaceImport?: string; // Namespace import (import * as name)
  typeOnly: boolean; // import type { ... }
  startLine: number;
  endLine: number;
  originalText: string;
}

interface ImportGroup {
  category: "builtin" | "external" | "internal" | "relative";
  imports: ImportStatement[];
  priority: number; // For sorting groups
}

interface ImportStructure {
  groups: ImportGroup[];
  allImports: ImportStatement[];
  hasTypeImports: boolean;
  importRegion: { start: number; end: number };
}

interface ImportEditPattern {
  type:
    | "add_import"
    | "remove_import"
    | "reorganize_imports"
    | "update_imports"
    | "convert_import_style";
  confidence: number;
  evidence: string[];
  affectedImports: string[];
}

interface ImportConfig {
  enableImportOptimizations: boolean;
  groupImports: boolean; // Group by category
  sortImports: boolean; // Sort within groups
  separateTypeImports: boolean; // Separate type imports
  removeUnusedImports: boolean; // Remove unused imports
  preferSingleQuotes: boolean; // Quote style preference
  trailingComma: boolean; // Trailing comma in multiline imports
}

const DEFAULT_IMPORT_CONFIG: ImportConfig = {
  enableImportOptimizations: true,
  groupImports: true,
  sortImports: true,
  separateTypeImports: true,
  removeUnusedImports: false, // Conservative default
  preferSingleQuotes: true,
  trailingComma: true,
};

// Import categorization patterns
const BUILTIN_MODULES = new Set([
  "fs",
  "path",
  "http",
  "https",
  "url",
  "crypto",
  "util",
  "events",
  "stream",
  "buffer",
  "child_process",
  "cluster",
  "os",
  "readline",
  "zlib",
]);

const IMPORT_PATTERNS = {
  // import foo from 'bar'
  default: /^import\s+(\w+)\s+from\s+['"]([^'"]+)['"];?$/,
  // import { foo, bar } from 'baz'
  named: /^import\s*\{\s*([^}]+)\s*\}\s+from\s+['"]([^'"]+)['"];?$/,
  // import * as foo from 'bar'
  namespace: /^import\s*\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"];?$/,
  // import 'foo'
  sideEffect: /^import\s+['"]([^'"]+)['"];?$/,
  // import type { foo } from 'bar'
  typeOnly: /^import\s+type\s*\{\s*([^}]+)\s*\}\s+from\s+['"]([^'"]+)['"];?$/,
};

/**
 * Parse import statements from TypeScript/JavaScript code
 */
function parseImportStructure(
  content: string,
  filename: string,
): ImportStructure {
  const lines = content.split("\n");
  const imports: ImportStatement[] = [];
  let importStart = -1;
  let importEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("//") || line.startsWith("/*")) continue;

    const importStatement = parseImportLine(line, i);
    if (importStatement) {
      imports.push(importStatement);
      if (importStart === -1) importStart = i;
      importEnd = i;
    } else if (imports.length > 0 && !isImportRelated(line)) {
      // First non-import line after imports
      break;
    }
  }

  const groups = categorizeImports(imports, filename);

  return {
    groups,
    allImports: imports,
    hasTypeImports: imports.some((imp) => imp.typeOnly),
    importRegion: { start: importStart, end: importEnd },
  };
}

function parseImportLine(
  line: string,
  lineNumber: number,
): ImportStatement | null {
  // Type-only imports
  const typeOnlyMatch = line.match(IMPORT_PATTERNS.typeOnly);
  if (typeOnlyMatch) {
    return {
      type: "type_only",
      source: typeOnlyMatch[2],
      namedImports: typeOnlyMatch[1].split(",").map((s) => s.trim()),
      typeOnly: true,
      startLine: lineNumber,
      endLine: lineNumber,
      originalText: line,
    };
  }

  // Named imports
  const namedMatch = line.match(IMPORT_PATTERNS.named);
  if (namedMatch) {
    return {
      type: "named",
      source: namedMatch[2],
      namedImports: namedMatch[1].split(",").map((s) => s.trim()),
      typeOnly: false,
      startLine: lineNumber,
      endLine: lineNumber,
      originalText: line,
    };
  }

  // Default imports
  const defaultMatch = line.match(IMPORT_PATTERNS.default);
  if (defaultMatch) {
    return {
      type: "default",
      source: defaultMatch[2],
      defaultImport: defaultMatch[1],
      namedImports: [],
      typeOnly: false,
      startLine: lineNumber,
      endLine: lineNumber,
      originalText: line,
    };
  }

  // Namespace imports
  const namespaceMatch = line.match(IMPORT_PATTERNS.namespace);
  if (namespaceMatch) {
    return {
      type: "namespace",
      source: namespaceMatch[2],
      namespaceImport: namespaceMatch[1],
      namedImports: [],
      typeOnly: false,
      startLine: lineNumber,
      endLine: lineNumber,
      originalText: line,
    };
  }

  // Side effect imports
  const sideEffectMatch = line.match(IMPORT_PATTERNS.sideEffect);
  if (sideEffectMatch) {
    return {
      type: "side_effect",
      source: sideEffectMatch[1],
      namedImports: [],
      typeOnly: false,
      startLine: lineNumber,
      endLine: lineNumber,
      originalText: line,
    };
  }

  return null;
}

function isImportRelated(line: string): boolean {
  return (
    line.startsWith("import ") ||
    line.startsWith("export ") ||
    line.includes("from ") ||
    line === "" ||
    line.startsWith("//") ||
    line.startsWith("/*")
  );
}

function categorizeImports(
  imports: ImportStatement[],
  filename: string,
): ImportGroup[] {
  const groups: Map<string, ImportStatement[]> = new Map([
    ["builtin", []],
    ["external", []],
    ["internal", []],
    ["relative", []],
  ]);

  for (const imp of imports) {
    const category = categorizeImport(imp.source, filename);
    groups.get(category)!.push(imp);
  }

  return Array.from(groups.entries())
    .map(([category, imports], index) => ({
      category: category as ImportGroup["category"],
      imports,
      priority: index,
    }))
    .filter((group) => group.imports.length > 0);
}

function categorizeImport(source: string, filename: string): string {
  // Built-in Node.js modules
  if (BUILTIN_MODULES.has(source) || source.startsWith("node:")) {
    return "builtin";
  }

  // Relative imports
  if (source.startsWith("./") || source.startsWith("../")) {
    return "relative";
  }

  // Internal imports (same project)
  const projectName = getProjectName(filename);
  if (
    source.startsWith("@/") ||
    source.startsWith("~/") ||
    (projectName && source.startsWith(projectName))
  ) {
    return "internal";
  }

  // External packages
  return "external";
}

function getProjectName(filename: string): string {
  // Extract project name from filename or use heuristics
  const parts = filename.split("/");
  const srcIndex = parts.findIndex((part) => part === "src");
  if (srcIndex > 0) {
    return parts[srcIndex - 1];
  }
  return "";
}

/**
 * Detect import editing patterns
 */
function detectImportEditPattern(
  oldStructure: ImportStructure,
  newStructure: ImportStructure,
): ImportEditPattern {
  const evidence: string[] = [];
  let patternType: ImportEditPattern["type"] = "update_imports";
  let confidence = 0.3;
  const affectedImports: string[] = [];

  const oldImportSources = new Set(
    oldStructure.allImports.map((imp) => imp.source),
  );
  const newImportSources = new Set(
    newStructure.allImports.map((imp) => imp.source),
  );

  // Check for new imports
  const addedImports = newStructure.allImports.filter(
    (imp) => !oldImportSources.has(imp.source),
  );
  if (addedImports.length > 0) {
    patternType = "add_import";
    confidence = 0.8;
    evidence.push(`Added ${addedImports.length} new import(s)`);
    affectedImports.push(...addedImports.map((imp) => imp.source));
  }

  // Check for removed imports
  const removedImports = oldStructure.allImports.filter(
    (imp) => !newImportSources.has(imp.source),
  );
  if (removedImports.length > 0) {
    patternType = "remove_import";
    confidence = Math.max(confidence, 0.7);
    evidence.push(`Removed ${removedImports.length} import(s)`);
    affectedImports.push(...removedImports.map((imp) => imp.source));
  }

  // Check for reorganization
  const reorganized = checkImportReorganization(oldStructure, newStructure);
  if (reorganized.isReorganized) {
    patternType = "reorganize_imports";
    confidence = Math.max(confidence, 0.6);
    evidence.push("Imports reorganized");
    evidence.push(...reorganized.details);
  }

  // Check for import style changes
  const styleChanges = detectImportStyleChanges(oldStructure, newStructure);
  if (styleChanges.length > 0) {
    patternType = "convert_import_style";
    confidence = Math.max(confidence, 0.5);
    evidence.push(`Import style changes: ${styleChanges.join(", ")}`);
  }

  return {
    type: patternType,
    confidence: Math.min(confidence, 1.0),
    evidence,
    affectedImports,
  };
}

function checkImportReorganization(
  oldStructure: ImportStructure,
  newStructure: ImportStructure,
): { isReorganized: boolean; details: string[] } {
  const details: string[] = [];

  // Check if import order changed significantly
  const oldOrder = oldStructure.allImports.map((imp) => imp.source);
  const newOrder = newStructure.allImports.map((imp) => imp.source);

  if (oldOrder.length === newOrder.length) {
    let orderChanges = 0;
    for (let i = 0; i < oldOrder.length; i++) {
      if (oldOrder[i] !== newOrder[i]) {
        orderChanges++;
      }
    }

    const orderChangeRatio = orderChanges / oldOrder.length;
    if (orderChangeRatio > 0.3) {
      details.push(
        `${Math.round(orderChangeRatio * 100)}% of imports reordered`,
      );
      return { isReorganized: true, details };
    }
  }

  // Check grouping changes
  const oldGroupCount = oldStructure.groups.length;
  const newGroupCount = newStructure.groups.length;
  if (oldGroupCount !== newGroupCount) {
    details.push(
      `Import grouping changed (${oldGroupCount} → ${newGroupCount} groups)`,
    );
    return { isReorganized: true, details };
  }

  return { isReorganized: false, details };
}

function detectImportStyleChanges(
  oldStructure: ImportStructure,
  newStructure: ImportStructure,
): string[] {
  const changes: string[] = [];

  // Compare same imports for style changes
  const oldImportMap = new Map(
    oldStructure.allImports.map((imp) => [imp.source, imp]),
  );
  const newImportMap = new Map(
    newStructure.allImports.map((imp) => [imp.source, imp]),
  );

  for (const [source, oldImp] of oldImportMap) {
    const newImp = newImportMap.get(source);
    if (!newImp) continue;

    // Type-only conversion
    if (oldImp.typeOnly !== newImp.typeOnly) {
      changes.push(
        newImp.typeOnly
          ? "converted to type import"
          : "converted from type import",
      );
    }

    // Import type changes
    if (oldImp.type !== newImp.type) {
      changes.push(`${oldImp.type} → ${newImp.type}`);
    }

    // Named imports changes
    if (oldImp.namedImports.length !== newImp.namedImports.length) {
      changes.push("named imports modified");
    }
  }

  return changes;
}

/**
 * Reconstruct import section with optimizations
 */
function reconstructImportSection(
  oldContent: string,
  newLazyContent: string,
  oldStructure: ImportStructure,
  newStructure: ImportStructure,
  pattern: ImportEditPattern,
  config: ImportConfig,
): string {
  const lines = newLazyContent.split("\n");

  // Generate optimized imports
  const optimizedImports = generateOptimizedImports(newStructure, config);

  // Replace import region
  const beforeImports = lines.slice(
    0,
    Math.max(0, newStructure.importRegion.start),
  );
  const afterImports = lines.slice(newStructure.importRegion.end + 1);

  return [...beforeImports, ...optimizedImports, "", ...afterImports].join(
    "\n",
  );
}

function generateOptimizedImports(
  structure: ImportStructure,
  config: ImportConfig,
): string[] {
  const result: string[] = [];

  if (!config.groupImports) {
    // Simple case: just format each import
    for (const imp of structure.allImports) {
      result.push(formatImportStatement(imp, config));
    }
    return result;
  }

  // Group and sort imports
  const sortedGroups = [...structure.groups].sort(
    (a, b) => a.priority - b.priority,
  );

  for (let i = 0; i < sortedGroups.length; i++) {
    const group = sortedGroups[i];

    if (group.imports.length === 0) continue;

    // Add blank line between groups (except first)
    if (i > 0) {
      result.push("");
    }

    // Sort imports within group
    const sortedImports = config.sortImports
      ? [...group.imports].sort((a, b) => a.source.localeCompare(b.source))
      : group.imports;

    // Separate type imports if enabled
    if (config.separateTypeImports) {
      const regularImports = sortedImports.filter((imp) => !imp.typeOnly);
      const typeImports = sortedImports.filter((imp) => imp.typeOnly);

      for (const imp of regularImports) {
        result.push(formatImportStatement(imp, config));
      }

      if (typeImports.length > 0 && regularImports.length > 0) {
        result.push("");
      }

      for (const imp of typeImports) {
        result.push(formatImportStatement(imp, config));
      }
    } else {
      for (const imp of sortedImports) {
        result.push(formatImportStatement(imp, config));
      }
    }
  }

  return result;
}

function formatImportStatement(
  imp: ImportStatement,
  config: ImportConfig,
): string {
  const quote = config.preferSingleQuotes ? "'" : '"';

  switch (imp.type) {
    case "default":
      return `import ${imp.defaultImport} from ${quote}${imp.source}${quote};`;

    case "named":
      if (imp.namedImports.length === 1) {
        return `import { ${imp.namedImports[0]} } from ${quote}${imp.source}${quote};`;
      } else {
        const imports = imp.namedImports.join(
          config.trailingComma ? ", " : ",",
        );
        return `import { ${imports} } from ${quote}${imp.source}${quote};`;
      }

    case "namespace":
      return `import * as ${imp.namespaceImport} from ${quote}${imp.source}${quote};`;

    case "side_effect":
      return `import ${quote}${imp.source}${quote};`;

    case "type_only":
      const typeImports = imp.namedImports.join(
        config.trailingComma ? ", " : ",",
      );
      return `import type { ${typeImports} } from ${quote}${imp.source}${quote};`;

    default:
      return imp.originalText;
  }
}

/**
 * Main import-aware lazy edit function
 */
export async function importAwareLazyEdit({
  oldFile,
  newLazyFile,
  filename,
  enableImportOptimizations = true,
  importConfig = DEFAULT_IMPORT_CONFIG,
}: {
  oldFile: string;
  newLazyFile: string;
  filename: string;
  enableImportOptimizations?: boolean;
  importConfig?: ImportConfig;
}): Promise<DiffLine[] | undefined> {
  // Check if this is a TypeScript/JavaScript file
  const isCodeFile = /\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(filename);

  if (
    !isCodeFile ||
    !enableImportOptimizations ||
    !importConfig.enableImportOptimizations
  ) {
    return deterministicApplyLazyEdit({
      oldFile,
      newLazyFile: newLazyFile,
      filename,
    });
  }

  try {
    console.debug(`Processing import optimizations for: ${filename}`);

    // Parse import structures
    const oldStructure = parseImportStructure(oldFile, filename);
    const newStructure = parseImportStructure(newLazyFile, filename);

    console.debug(
      `Old imports: ${oldStructure.allImports.length}, New imports: ${newStructure.allImports.length}`,
    );

    // Detect editing pattern
    const pattern = detectImportEditPattern(oldStructure, newStructure);
    console.debug(
      `Detected pattern: ${pattern.type} (confidence: ${pattern.confidence.toFixed(2)})`,
    );
    console.debug(`Evidence: ${pattern.evidence.join(", ")}`);

    // Reconstruct with optimizations
    const reconstructedFile = reconstructImportSection(
      oldFile,
      newLazyFile,
      oldStructure,
      newStructure,
      pattern,
      importConfig,
    );

    // Generate diff
    const { myersDiff } = await import("../../../diff/myers");
    const diff = myersDiff(oldFile, reconstructedFile);

    // Validate the diff
    const validation = validateImportDiff(
      diff,
      oldFile,
      reconstructedFile,
      pattern,
    );

    if (validation.isAcceptable) {
      return diff;
    } else {
      console.debug("Import optimization validation failed, falling back");
      console.debug(`Issues: ${validation.issues.join(", ")}`);
      return deterministicApplyLazyEdit({
        oldFile,
        newLazyFile: newLazyFile,
        filename,
      });
    }
  } catch (error) {
    console.debug("Import optimization failed:", error);
    return deterministicApplyLazyEdit({
      oldFile,
      newLazyFile: newLazyFile,
      filename,
    });
  }
}

function validateImportDiff(
  diff: DiffLine[],
  oldFile: string,
  newFile: string,
  pattern: ImportEditPattern,
): { isAcceptable: boolean; confidence: number; issues: string[] } {
  const issues: string[] = [];
  let confidence = pattern.confidence;

  // Check that import changes are in import region
  const importRegionLines = diff.filter((line, index) => index < 50); // First 50 lines typically
  const importChanges = diff.filter(
    (line) =>
      line.type !== "same" &&
      (line.line.includes("import ") || line.line.includes("from ")),
  );

  if (importChanges.length === 0 && pattern.type !== "update_imports") {
    issues.push("No import changes detected");
    confidence -= 0.3;
  }

  // Check for syntax errors in imports
  const newImports = newFile
    .split("\n")
    .filter((line) => line.trim().startsWith("import "));
  for (const imp of newImports.slice(0, 10)) {
    // Check first 10 imports
    if (!isValidImportStatement(imp)) {
      issues.push("Invalid import syntax detected");
      confidence -= 0.5;
      break;
    }
  }

  return {
    isAcceptable: confidence >= 0.3 && issues.length < 3,
    confidence,
    issues,
  };
}

function isValidImportStatement(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.match(/^import\s+.*from\s+['"][^'"]+['"];?$/) !== null ||
    trimmed.match(/^import\s+['"][^'"]+['"];?$/) !== null ||
    trimmed.match(/^import\s+type\s+.*from\s+['"][^'"]+['"];?$/) !== null
  );
}

/**
 * Utility functions for import processing
 */
export const importUtils = {
  parseImportStructure,
  categorizeImport,
  formatImportStatement,
  detectImportEditPattern,
};
