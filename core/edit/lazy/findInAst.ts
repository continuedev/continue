import Parser from "web-tree-sitter";

export function findInAst(
  node: Parser.SyntaxNode,
  criterion: (node: Parser.SyntaxNode) => boolean,
): Parser.SyntaxNode | null {
  const stack = [node];
  while (stack.length > 0) {
    let node = stack.pop()!;
    if (criterion(node)) {
      return node;
    }
    stack.push(...node.children);
  }
  return null;
}
