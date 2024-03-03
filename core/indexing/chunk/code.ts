import { SyntaxNode } from "web-tree-sitter";
import { ChunkWithoutID } from "../..";
import { countTokens } from "../../llm/countTokens";
import { getParserForFile } from "../../util/treeSitter";

function collapsedReplacement(node: SyntaxNode): string {
  if (node.type === "statement_block") {
    return "{ ... }";
  } else {
    return "...";
  }
}

function firstChild(
  node: SyntaxNode,
  grammarName: string | string[],
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
  collapseBlockTypes: string[],
  maxChunkSize: number,
): string {
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
  while (countTokens(code) > maxChunkSize && collapsedChildren.length > 0) {
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

function constructClassDefinitionChunk(
  node: SyntaxNode,
  code: string,
  maxChunkSize: number,
): string {
  return collapseChildren(
    node,
    code,
    ["block", "class_body", "declaration_list"],
    ["method_definition", "function_definition", "function_item"],
    ["block", "statement_block"],
    maxChunkSize,
  );
}

function constructFunctionDefinitionChunk(
  node: SyntaxNode,
  code: string,
  maxChunkSize: number,
): string {
  const bodyNode = node.children[node.children.length - 1];
  const funcText =
    code.slice(node.startIndex, bodyNode.startIndex) +
    collapsedReplacement(bodyNode);

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
  [key: string]: (
    node: SyntaxNode,
    code: string,
    maxChunkSize: number,
  ) => string;
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
  root = true,
): Generator<ChunkWithoutID> {
  // Keep entire text if not over size
  if (
    (root || node.type in collapsedNodeConstructors) &&
    countTokens(node.text) < maxChunkSize
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
      content: collapsedNodeConstructors[node.type](node, code, maxChunkSize),
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
  maxChunkSize: number,
): AsyncGenerator<ChunkWithoutID> {
  if (contents.trim().length === 0) {
    return;
  }

  let parser = await getParserForFile(filepath);
  if (parser === undefined) {
    console.warn(`Failed to load parser for file ${filepath}: `);
    return;
  }

  const tree = parser.parse(contents);

  yield* getSmartCollapsedChunks(tree.rootNode, contents, maxChunkSize);
}
