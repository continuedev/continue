import { longestCommonSubsequence } from "../../util/lcs.js";
import { SourceFragment } from "../../util/SourceFragment.js";
import { lineIsRepeated } from "../filtering/streamTransforms/lineStream.js";

import type { ILLM } from "../../index.js";

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
function isOnlyWhitespace(completion: string): boolean {
  const whitespaceRegex = /^[\s]+$/;
  return whitespaceRegex.test(completion);
}

function isBlank(completion: string): boolean {
  return completion.trim().length === 0;
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
  if (isBlank(completion)) {
    return undefined;
  }

  // Don't return whitespace
  if (isOnlyWhitespace(completion)) {
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

  if (llm.model.includes("codestral")) {
    // Codestral sometimes starts with an extra space
    if (completion[0] === " " && completion[1] !== " ") {
      if (prefix.endsWith(" ") && suffix.startsWith("\n")) {
        completion = completion.slice(1);
      }
    }

    // When there is no suffix, Codestral tends to begin with a new line
    // We do this to avoid double new lines
    if (
      suffix.length === 0 &&
      prefix.endsWith("\n\n") &&
      completion.startsWith("\n")
    ) {
      // Remove a single leading \n from the completion
      completion = completion.slice(1);
    }
  }

  // Granite tends to leak parts of the prefix into the completion result, and
  // in some cases runs past the suffix. This code truncates the completion at
  // the suffix and also removes redundant bits of the prefix from the
  // completion.
  if (llm.model.includes("mercury") || llm.model.includes("granite")) {
    const prefixFragment = new SourceFragment(prefix);
    const suffixFragment = new SourceFragment(suffix);
    const completionFragment = new SourceFragment(completion);

    const truncatedCompletion = completionFragment.getAsTruncatedFragment({
      suffix: suffixFragment,
      ignoreWhitespace: true
    });

    const remainingCompletion = prefixFragment.getRemainingCompletion(
      truncatedCompletion,
      { ignoreWhitespace: true, },
    );

    if (remainingCompletion)
      completion = remainingCompletion.getAsText();
    else
      completion = truncatedCompletion.getAsText();
  }

  // // If completion starts with multiple whitespaces, but the cursor is at the end of the line
  // // then it should probably be on a new line
  if (
    llm.model.includes("mercury") &&
    (completion.startsWith("  ") || completion.startsWith("\t")) &&
    !prefix.endsWith("\n") &&
    (suffix.startsWith("\n") || suffix.trim().length === 0)
  ) {
    completion = "\n" + completion;
  }

  // If prefix ends with space and so does completion, then remove the space from completion

  if (prefix.endsWith(" ") && completion.startsWith(" ")) {
    completion = completion.slice(1);
  }

  return completion;
}
