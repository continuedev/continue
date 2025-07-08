import Parser from "web-tree-sitter";

/**
 * Enhanced AST search with better error handling and performance
 */
export function findInAst(
  node: Parser.SyntaxNode,
  criterion: (node: Parser.SyntaxNode) => boolean,
  shouldRecurse: (node: Parser.SyntaxNode) => boolean = () => true,
): Parser.SyntaxNode | null {
  if (!node) {
    return null;
  }

  const stack = [node];

  const visited = new Set<Parser.SyntaxNode>();
  let iterations = 0;
  const maxIterations = 10000; // Prevent infinite loops

  while (stack.length > 0 && iterations < maxIterations) {
    iterations++;
    const currentNode = stack.pop()!;

    // Avoid cycles
    if (visited.has(currentNode)) {
      continue;
    }
    visited.add(currentNode);

    try {
      if (criterion(currentNode)) {
        return currentNode;
      }

      if (shouldRecurse(currentNode) && currentNode.children) {
        // Add children in reverse order so we process them in original order
        for (let i = currentNode.children.length - 1; i >= 0; i--) {
          const child = currentNode.children[i];
          if (child && !visited.has(child)) {
            stack.push(child);
          }
        }
      }
    } catch (error) {
      console.debug("Error processing AST node:", error);
      continue;
    }
  }

  if (iterations >= maxIterations) {
    console.warn(
      "findInAst reached maximum iterations, possible infinite loop",
    );
  }

  return null;
}

/**
 * Find all nodes matching a criterion
 */
export function findAllInAst(
  node: Parser.SyntaxNode,
  criterion: (node: Parser.SyntaxNode) => boolean,
  shouldRecurse: (node: Parser.SyntaxNode) => boolean = () => true,
): Parser.SyntaxNode[] {
  if (!node) {
    return [];
  }

  const results: Parser.SyntaxNode[] = [];
  const stack = [node];
  const visited = new Set<Parser.SyntaxNode>();
  let iterations = 0;
  const maxIterations = 10000;

  while (stack.length > 0 && iterations < maxIterations) {
    iterations++;
    const currentNode = stack.pop()!;

    if (visited.has(currentNode)) {
      continue;
    }
    visited.add(currentNode);

    try {
      if (criterion(currentNode)) {
        results.push(currentNode);
      }

      if (shouldRecurse(currentNode) && currentNode.children) {
        // Add children in reverse order
        for (let i = currentNode.children.length - 1; i >= 0; i--) {
          const child = currentNode.children[i];
          if (child && !visited.has(child)) {
            stack.push(child);
          }
        }
      }
    } catch (error) {
      console.debug("Error processing AST node:", error);
      continue;
    }
  }

  return results;
}

/**
 * Find the closest parent node matching a criterion
 */
export function findParentInAst(
  node: Parser.SyntaxNode,
  criterion: (node: Parser.SyntaxNode) => boolean,
): Parser.SyntaxNode | null {
  let current = node.parent;
  let depth = 0;
  const maxDepth = 100; // Prevent infinite recursion

  while (current && depth < maxDepth) {
    depth++;
    try {
      if (criterion(current)) {
        return current;
      }
      current = current.parent;
    } catch (error) {
      console.debug("Error processing parent AST node:", error);
      break;
    }
  }

  return null;
}
