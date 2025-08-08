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

export interface DiffMetadata {
  oldFilename?: string; // Filename in the original version
  newFilename?: string; // Filename in the modified version
  oldTimestamp?: string; // Timestamp of the original file
  newTimestamp?: string; // Timestamp of the modified file
  hunks?: Array<{
    // Information about each change hunk
    oldStart: number; // Starting line in original file
    oldCount: number; // Number of lines in original file
    newStart: number; // Starting line in modified file
    newCount: number; // Number of lines in modified file
    header?: string; // Optional section header
  }>;
  isBinary?: boolean; // Whether this is a binary file diff
  isNew?: boolean; // Whether this is a new file
  isDeleted?: boolean; // Whether this file was deleted
  isRename?: boolean; // Whether this file was renamed
}

export function extractMetadataFromUnifiedDiff(
  unifiedDiff: string,
): DiffMetadata {
  const metadata: DiffMetadata = {};
  const lines = unifiedDiff.split("\n");

  // Parse the header lines (first two lines)
  if (lines.length >= 2) {
    // Parse original file info (--- line)
    const oldFileMatch = lines[0].match(/^--- (a\/)?(.+?)(?:\t(.+))?$/);
    if (oldFileMatch) {
      metadata.oldFilename = oldFileMatch[2];
      metadata.oldTimestamp = oldFileMatch[3];

      // Check if this is a new file
      if (metadata.oldFilename === "/dev/null") {
        metadata.isNew = true;
      }
    }

    // Parse modified file info (+++ line)
    const newFileMatch = lines[1].match(/^\+\+\+ (b\/)?(.+?)(?:\t(.+))?$/);
    if (newFileMatch) {
      metadata.newFilename = newFileMatch[2];
      metadata.newTimestamp = newFileMatch[3];

      // Check if this file was deleted
      if (metadata.newFilename === "/dev/null") {
        metadata.isDeleted = true;
      }
    }

    // Check if this is a rename (different old and new names)
    if (
      metadata.oldFilename &&
      metadata.newFilename &&
      metadata.oldFilename !== "/dev/null" &&
      metadata.newFilename !== "/dev/null" &&
      metadata.oldFilename !== metadata.newFilename
    ) {
      metadata.isRename = true;
    }
  }

  // Parse hunk headers
  metadata.hunks = [];
  const hunkHeaderRegex =
    /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:\s(.*))?$/;

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    const hunkMatch = line.match(hunkHeaderRegex);

    if (hunkMatch) {
      metadata.hunks.push({
        oldStart: parseInt(hunkMatch[1], 10),
        oldCount: hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1,
        newStart: parseInt(hunkMatch[3], 10),
        newCount: hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1,
        header: hunkMatch[5],
      });
    }

    // Check for binary file marker
    if (line.includes("Binary files") || line.includes("GIT binary patch")) {
      metadata.isBinary = true;
    }
  }

  return metadata;
}
