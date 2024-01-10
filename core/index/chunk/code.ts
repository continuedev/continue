import Parser, { SyntaxNode } from "web-tree-sitter";
import { ChunkWithoutID } from ".";
import { countTokens } from "../../llm/countTokens";

export const fileExtensionToLanguage: { [key: string]: string } = {
  py: "python",
  js: "javascript",
  html: "html",
  java: "java",
  go: "go",
  rb: "ruby",
  rs: "rust",
  c: "c",
  cpp: "cpp",
  cs: "c_sharp",
  php: "php",
  css: "css",
  bash: "bash",
  json: "json",
  jl: "julia",
  scala: "scala",
  ts: "typescript",
  tsx: "tsx",
  // swift: "swift",
  // kt: "kotlin",
};

async function getParserForFile(filepath: string) {
  await Parser.init();
  const parser = new Parser();
  const segs = filepath.split(".");
  const wasmPath = `/tree-sitter/tree-sitter-${
    fileExtensionToLanguage[segs[segs.length - 1]]
  }.wasm`;
  const Language = await Parser.Language.load(wasmPath);
  parser.setLanguage(Language);
  return parser;
}

function collapsedReplacement(node: SyntaxNode): string {
  if (node.type === "statement_block") {
    return "{ ... }";
  } else {
    return "...";
  }
}

function firstChild(
  node: SyntaxNode,
  grammarName: string | string[]
): SyntaxNode | null {
  if (Array.isArray(grammarName)) {
    return (
      node.children.find((child) => grammarName.includes(child.type)) || null
    );
  } else {
    return node.children.find((child) => child.type === grammarName) || null;
  }
}

function collapseChildren(
  node: SyntaxNode,
  code: string,
  blockTypes: string[],
  collapseTypes: string[],
  collapseBlockTypes: string[]
): string {
  code = code.slice(0, node.endIndex);
  const block = firstChild(node, blockTypes);
  if (block) {
    const childrenToCollapse = block.children.filter((child) =>
      collapseTypes.includes(child.type)
    );
    for (const child of childrenToCollapse.reverse()) {
      const grandChild = firstChild(child, collapseBlockTypes);
      if (grandChild) {
        const start = grandChild.startIndex;
        const end = grandChild.endIndex;
        code =
          code.slice(0, start) +
          collapsedReplacement(grandChild) +
          code.slice(end);
      }
    }
  }
  return code.slice(node.startIndex);
}

function constructClassDefinitionChunk(node: SyntaxNode, code: string): string {
  return collapseChildren(
    node,
    code,
    ["block", "class_body", "declaration_list"],
    ["method_definition", "function_definition", "function_item"],
    ["block", "statement_block"]
  );
}

function constructFunctionDefinitionChunk(
  node: SyntaxNode,
  code: string
): string {
  const funcText = node.text;
  if (
    node.parent &&
    ["block", "declaration_list"].includes(node.parent.type) &&
    node.parent.parent &&
    ["class_definition", "impl_item"].includes(node.parent.parent.type)
  ) {
    // If inside a class, include the class header
    const classNode = node.parent.parent;
    const classBlock = node.parent;
    return (
      code.slice(classNode.startIndex, classBlock.startIndex) +
      "...\n\n" +
      " ".repeat(node.startPosition.column) + // ...
      funcText
    );
  }
  return funcText;
}

const collapsedNodeConstructors: {
  [key: string]: (node: SyntaxNode, code: string) => string;
} = {
  // Classes, structs, etc
  class_definition: constructClassDefinitionChunk,
  class_declaration: constructClassDefinitionChunk,
  impl_item: constructClassDefinitionChunk,
  // Functions
  function_definition: constructFunctionDefinitionChunk,
  function_declaration: constructFunctionDefinitionChunk,
  function_item: constructFunctionDefinitionChunk,
};

function* getSmartCollapsedChunks(
  node: SyntaxNode,
  code: string,
  maxChunkSize: number,
  root = true
): Generator<ChunkWithoutID> {
  // Keep entire text if not over size
  if (
    (root || node.type in collapsedNodeConstructors) &&
    countTokens(node.text, "gpt-4") < maxChunkSize
  ) {
    yield {
      content: node.text,
      startLine: node.startPosition.row,
      endLine: node.endPosition.row,
    };
    return;
  }

  // If a collapsed form is defined, use that
  if (node.type in collapsedNodeConstructors) {
    yield {
      content: collapsedNodeConstructors[node.type](node, code),
      startLine: node.startPosition.row,
      endLine: node.endPosition.row,
    };
  }

  // Recurse (because even if collapsed version was shown, want to show the children in full somewhere)
  for (const child of node.children) {
    yield* getSmartCollapsedChunks(child, code, maxChunkSize, false);
  }
}

export async function* codeChunker(
  filepath: string,
  contents: string,
  maxChunkSize: number
): AsyncGenerator<ChunkWithoutID> {
  if (contents.trim().length === 0) {
    return;
  }
  let parser: Parser;
  try {
    parser = await getParserForFile(filepath);
  } catch (e) {
    console.warn(`Failed to load parser for file ${filepath}: `, e);
    return;
  }

  const tree = parser.parse(contents);

  yield* getSmartCollapsedChunks(tree.rootNode, contents, maxChunkSize);
}
