import * as path from "path";

export function parseSearchAndReplaceArgs(args: any): {
  filepath: string;
  diffs: string[];
} {
  const { filepath, diffs: diffsArg } = args;

  if (!filepath || !diffsArg) {
    throw new Error("filepath and diffs args are required");
  }

  if (typeof filepath !== "string") {
    throw new Error("filepath must be a string");
  }

  const diffs: string[] = [];
  if (!Array.isArray(diffsArg)) {
    throw new Error("diffs must be an array of string search/replace blocks");
  }
  diffsArg.forEach((diff, i) => {
    if (typeof diff !== "string") {
      throw new Error(`Diff at ${i + 1} is not a string`);
    }
    diffs.push(diff);
  });

  const fixedPath = filepath.replace(/\/|\\/g, path.sep);

  return {
    filepath: fixedPath,
    diffs,
  };
}
