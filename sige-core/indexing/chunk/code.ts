import { SyntaxNode } from "web-tree-sitter";

import { ChunkWithoutID } from "../../index.js";
import { countTokensAsync } from "../../llm/countTokens.js";
import { getParserForFile } from "../../util/treeSitter.js";

function collapsedReplacement(node: SyntaxNode): string {
  if (node.type === "statement_block") {
    return "{ ... }";
  }
  return "...";
}

function firstChild(
  node: SyntaxNode,
  grammarName: string | string[],
): SyntaxNode | null {
  if (Array.isArray(grammarName)) {
    return (
      node.children.find((child) => grammarName.includes(child.type)) || null
    );
  }
  return node.children.find((child) => child.type === grammarName) || null;
}

async function collapseChildren(
  node: SyntaxNode,
  code: string,
  blockTypes: string[],
  collapseTypes: string[],
  collapseBlockTypes: string[],
  maxChunkSize: number,
): Promise<string> {
  code = code.slice(0, node.endIndex);
  const block = firstChild(node, blockTypes);
  const collapsedChildren = [];

  if (block) {
    const childrenToCollapse = block.children.filter((child) =>
      collapseTypes.includes(child.type),
    );
    for (const child of childrenToCollapse.reverse()) {
      const grandChild = firstChild(child, collapseBlockTypes);
      if (grandChild) {
        const start = grandChild.startIndex;
        const end = grandChild.endIndex;
        const collapsedChild =
          code.slice(child.startIndex, start) +
          collapsedReplacement(grandChild);
        code =
          code.slice(0, start) +
          collapsedReplacement(grandChild) +
          code.slice(end);

        collapsedChildren.unshift(collapsedChild);
      }
    }
  }
  code = code.slice(node.startIndex);
  let removedChild = false;
  while (
    (await countTokensAsync(code.trim())) > maxChunkSize &&
    collapsedChildren.length > 0
  ) {
    removedChild = true;
    // Remove children starting at the end - TODO: Add multiple chunks so no children are missing
    const childCode = collapsedChildren.pop()!;
    const index = code.lastIndexOf(childCode);
    if (index > 0) {
      code = code.slice(0, index) + code.slice(index + childCode.length);
    }
  }

  if (removedChild) {
    // Remove the extra blank lines
    let lines = code.split("\n");
    let firstWhiteSpaceInGroup = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim() === "") {
        if (firstWhiteSpaceInGroup < 0) {
          firstWhiteSpaceInGroup = i;
        }
      } else {
        if (firstWhiteSpaceInGroup - i > 1) {
          // Remove the lines
          lines = [
            ...lines.slice(0, i + 1),
            ...lines.slice(firstWhiteSpaceInGroup + 1),
          ];
        }
        firstWhiteSpaceInGroup = -1;
      }
    }

    code = lines.join("\n");
  }

  return code;
}

export const FUNCTION_BLOCK_NODE_TYPES = ["block", "statement_block"];
export const FUNCTION_DECLARATION_NODE_TYPEs = [
  "method_definition",
  "function_definition",
  "function_item",
  "function_declaration",
  "method_declaration",
];

async function constructClassDefinitionChunk(
  node: SyntaxNode,
  code: string,
  maxChunkSize: number,
): Promise<string> {
  return collapseChildren(
    node,
    code,
    ["block", "class_body", "declaration_list"],
    FUNCTION_DECLARATION_NODE_TYPEs,
    FUNCTION_BLOCK_NODE_TYPES,
    maxChunkSize,
  );
}

async function constructFunctionDefinitionChunk(
  node: SyntaxNode,
  code: string,
  maxChunkSize: number,
): Promise<string> {
  const bodyNode = node.children[node.children.length - 1];
  const collapsedBody = collapsedReplacement(bodyNode);
  const signature = code.slice(node.startIndex, bodyNode.startIndex);
  const funcText = signature + collapsedBody;

  const isInClass =
    node.parent &&
    ["block", "declaration_list"].includes(node.parent.type) &&
    node.parent.parent &&
    ["class_definition", "impl_item"].includes(node.parent.parent.type);

  if (isInClass) {
    const classNode = node.parent!.parent!;
    const classBlock = node.parent!;
    const classHeader = code.slice(classNode.startIndex, classBlock.startIndex);
    const indent = " ".repeat(node.startPosition.column);
    const combined = `${classHeader}...\n\n${indent}${funcText}`;

    if ((await countTokensAsync(combined)) <= maxChunkSize) {
      return combined;
    }
    if ((await countTokensAsync(funcText)) <= maxChunkSize) {
      return funcText;
    }
    const firstLine = signature.split("\n")[0] ?? "";
    const minimal = `${firstLine} ${collapsedBody}`;
    if ((await countTokensAsync(minimal)) <= maxChunkSize) {
      return minimal;
    }
    return collapsedBody;
  }

  if ((await countTokensAsync(funcText)) <= maxChunkSize) {
    return funcText;
  }
  const firstLine = signature.split("\n")[0] ?? "";
  const minimal = `${firstLine} ${collapsedBody}`;
  if ((await countTokensAsync(minimal)) <= maxChunkSize) {
    return minimal;
  }
  return collapsedBody;
}

const collapsedNodeConstructors: {
  [key: string]: (
    node: SyntaxNode,
    code: string,
    maxChunkSize: number,
  ) => Promise<string>;
} = {
  // Classes, structs, etc
  class_definition: constructClassDefinitionChunk,
  class_declaration: constructClassDefinitionChunk,
  impl_item: constructClassDefinitionChunk,
  // Functions
  function_definition: constructFunctionDefinitionChunk,
  function_declaration: constructFunctionDefinitionChunk,
  function_item: constructFunctionDefinitionChunk,
  // Methods
  method_declaration: constructFunctionDefinitionChunk,
  // Properties
};

async function maybeYieldChunk(
  node: SyntaxNode,
  code: string,
  maxChunkSize: number,
  root = true,
): Promise<ChunkWithoutID | undefined> {
  // Keep entire text if not over size
  if (root || node.type in collapsedNodeConstructors) {
    const tokenCount = await countTokensAsync(node.text);
    if (tokenCount < maxChunkSize) {
      return {
        content: node.text,
        startLine: node.startPosition.row,
        endLine: node.endPosition.row,
      };
    }
  }
  return undefined;
}

async function* getSmartCollapsedChunks(
  node: SyntaxNode,
  code: string,
  maxChunkSize: number,
  root = true,
): AsyncGenerator<ChunkWithoutID> {
  const chunk = await maybeYieldChunk(node, code, maxChunkSize, root);
  if (chunk) {
    yield chunk;
    return;
  }
  // If a collapsed form is defined, use that
  if (node.type in collapsedNodeConstructors) {
    yield {
      content: await collapsedNodeConstructors[node.type](
        node,
        code,
        maxChunkSize,
      ),
      startLine: node.startPosition.row,
      endLine: node.endPosition.row,
    };
  }

  // Recurse (because even if collapsed version was shown, want to show the children in full somewhere)
  const generators = node.children.map((child) =>
    getSmartCollapsedChunks(child, code, maxChunkSize, false),
  );
  for (const generator of generators) {
    yield* generator;
  }
}

export async function* codeChunker(
  filepath: string,
  contents: string,
  maxChunkSize: number,
): AsyncGenerator<ChunkWithoutID> {
  if (contents.trim().length === 0) {
    return;
  }

  const parser = await getParserForFile(filepath);
  if (parser === undefined) {
    throw new Error(`Failed to load parser for file ${filepath}: `);
  }

  const tree = parser.parse(contents);

  yield* getSmartCollapsedChunks(tree.rootNode, contents, maxChunkSize);
}
