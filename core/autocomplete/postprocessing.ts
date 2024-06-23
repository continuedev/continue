import type { ILLM } from "..";
import { longestCommonSubsequence } from "../util/lcs";
import { lineIsRepeated } from "./lineStream";

function rewritesLineAbove(completion: string, prefix: string): boolean {
  const lineAbove = prefix
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .slice(-1)[0];
  if (!lineAbove) {
    return false;
  }

  const firstLineOfCompletion = completion
    .split("\n")
    .find((line) => line.trim().length > 0);
  if (!firstLineOfCompletion) {
    return false;
  }
  return lineIsRepeated(lineAbove, firstLineOfCompletion);
}

const MAX_REPETITION_FREQ_TO_CHECK = 3;
function isExtremeRepetition(completion: string): boolean {
  const lines = completion.split("\n");
  if (lines.length < 6) {
    return false;
  }
  for (let freq = 1; freq < MAX_REPETITION_FREQ_TO_CHECK; freq++) {
    const lcs = longestCommonSubsequence(lines[0], lines[freq]);
    if (lcs.length > 5 || lcs.length > lines[0].length * 0.5) {
      let matchCount = 0;
      for (let i = 0; i < lines.length; i += freq) {
        if (lines[i].includes(lcs)) {
          matchCount++;
        }
      }
      if (matchCount * freq > 8 || (matchCount * freq) / lines.length > 0.8) {
        return true;
      }
    }
  }
  return false;
}

export function postprocessCompletion({
  completion,
  llm,
  prefix,
  suffix,
}: {
  completion: string;
  llm: ILLM;
  prefix: string;
  suffix: string;
}): string | undefined {
  // Don't return empty
  if (completion.trim().length <= 0) {
    return undefined;
  }

  // Dont return if it's just a repeat of the line above
  if (rewritesLineAbove(completion, prefix)) {
    return undefined;
  }

  // Filter out repetitions of many lines in a row
  if (isExtremeRepetition(completion)) {
    return undefined;
  }

  // Remove trailing whitespace
  completion = completion.trimEnd();

  if (llm.model.includes("codestral")) {
    // Codestral sometimes starts with an extra space
    if (completion[0] === " " && completion[1] !== " ") {
      if (prefix.endsWith(" ") && suffix.startsWith("\n")) {
        completion = completion.slice(1);
      }
    }
  }

  // If completion starts with multiple whitespaces, but the cursor is at the end of the line
  // then it should probably be on a new line
  if (
    (completion.startsWith("  ") || completion.startsWith("\t")) &&
    !prefix.endsWith("\n") &&
    (suffix.startsWith("\n") || suffix.trim().length === 0)
  ) {
    // completion = "\n" + completion;
    return undefined;
  }

  // If prefix ends with space and so does completion, then remove the space from completion
  if (prefix.endsWith(" ") && completion.startsWith(" ")) {
    completion = completion.slice(1);
  }

  return completion;
}
