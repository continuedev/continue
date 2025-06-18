import { createPatch } from "diff";

export enum DiffFormatType {
  Unified = "unified",
  Minimal = "minimal",
  TokenLineDiff = "linediff",
}

export const createDiff = (
  beforeContent: string,
  afterContent: string,
  filePath: string,
  diffType: DiffFormatType,
) => {
  switch (diffType) {
    case DiffFormatType.Unified:
      return createUnifiedDiff(beforeContent, afterContent, filePath);
    case DiffFormatType.Minimal:
      return createMinimalDiff(beforeContent, afterContent, filePath);
    case DiffFormatType.TokenLineDiff:
      return createTokenLineDiff(beforeContent, afterContent, filePath);
  }
};

const createUnifiedDiff = (
  beforeContent: string,
  afterContent: string,
  filePath: string,
) => {
  const normalizedBefore = beforeContent.endsWith("\n")
    ? beforeContent
    : beforeContent + "\n";
  const normalizedAfter = afterContent.endsWith("\n")
    ? afterContent
    : afterContent + "\n";

  const patch = createPatch(
    filePath,
    normalizedBefore,
    normalizedAfter,
    "before",
    "after",
    { context: 3 },
  );

  return patch;
};

const createMinimalDiff = (
  beforeContent: string,
  afterContent: string,
  filePath: string,
) => {
  // TODO: Implement minimal diff
  return "";
};

const createTokenLineDiff = (
  beforeContent: string,
  afterContent: string,
  filePath: string,
) => {
  // TODO: Implement token line diff
  return "";
};
