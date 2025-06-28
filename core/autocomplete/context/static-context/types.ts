import { Tree } from "web-tree-sitter";
import { Range } from "../../..";

interface TypeSpanAndSourceFile {
  typeSpan: string,
  sourceFile: string,
}

interface TypeSpanAndSourceFileAndAst extends TypeSpanAndSourceFile {
  ast: Tree
}

export interface HoleContext {
  fullHoverResult: string;
  functionName: string;
  functionTypeSpan: string;
  range: Range;
  source: string;
}

export type RelevantTypes = Map<string, TypeSpanAndSourceFileAndAst>;
export type RelevantHeaders = Set<TypeSpanAndSourceFile>;

