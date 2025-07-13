import { createPatch } from "diff";

export enum DiffFormatType {
  Unified = "unified",
  RawBeforeAfter = "beforeAfter",
  TokenLineDiff = "linediff",
}

export type BeforeAfterDiff = {
  filePath: string;
  beforeContent: string;
  afterContent: string;
};

export interface CreateDiffArgs {
  beforeContent: string;
  afterContent: string;
  filePath: string;
  diffType: DiffFormatType;
  contextLines: number;
}

export const createDiff = ({
  beforeContent,
  afterContent,
  filePath,
  diffType,
  contextLines,
}: CreateDiffArgs) => {
  switch (diffType) {
    case DiffFormatType.Unified:
      return createUnifiedDiff(
        beforeContent,
        afterContent,
        filePath,
        contextLines,
      );
    case DiffFormatType.TokenLineDiff:
      return createTokenLineDiff(beforeContent, afterContent, filePath);
  }
  return "";
};

const createUnifiedDiff = (
  beforeContent: string,
  afterContent: string,
  filePath: string,
  contextLines: number,
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
    { context: contextLines },
  );

  return patch;
};

export const createBeforeAfterDiff = (
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

  const result: BeforeAfterDiff = {
    filePath: filePath,
    beforeContent: normalizedBefore,
    afterContent: normalizedAfter,
  };

  return result;
};

const createTokenLineDiff = (
  beforeContent: string,
  afterContent: string,
  filePath: string,
) => {
  // TODO: Implement token line diff
  return "";
};
