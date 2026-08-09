import { longestCommonSubsequence } from "../../util/lcs.js";
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

/**
 * Removes markdown code block delimiters from completion.
 * Removes the first line if it starts with backticks (with optional language name).
 * Removes the last line if it contains only backticks.
 */
function removeBackticks(completion: string): string {
  const lines = completion.split("\n");

  if (lines.length === 0) {
    return completion;
  }

  let startIdx = 0;
  let endIdx = lines.length;

  // Remove first line if it starts with backticks (``` or ```language)
  const firstLineTrimmed = lines[0].trim();
  if (firstLineTrimmed.startsWith("```")) {
    startIdx = 1;
  }

  // Remove last line if it contains only backticks (one or more)
  if (lines.length > startIdx) {
    const lastLineTrimmed = lines[lines.length - 1].trim();
    if (lastLineTrimmed.length > 0 && /^`+$/.test(lastLineTrimmed)) {
      endIdx = lines.length - 1;
    }
  }

  // If we removed lines, return the modified completion
  if (startIdx > 0 || endIdx < lines.length) {
    return lines.slice(startIdx, endIdx).join("\n");
  }

  return completion;
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

  if (llm.model.includes("qwen3")) {
    // Qwen3 always starts from special thinking markers, and we don't want them to output these contents
    // Remove all content from "
    completion = completion.replace(/<think>.*?<\/think>/s, "");
    completion = completion.replace(/<\/think>/, "");

    // Remove any number of newline characters at the beginning and end
    completion = completion.replace(/^\n+|\n+$/g, "");
  }

  if (llm.model.includes("granite")) {
    // Granite tends to repeat the start of the line in the completion output
    let prefixEnd = prefix.split("\n").pop();
    if (prefixEnd) {
      if (completion.startsWith(prefixEnd)) {
        completion = completion.slice(prefixEnd.length);
      } else {
        const trimmedPrefix = prefixEnd.trim();
        const lastWord = trimmedPrefix.split(/\s+/).pop();
        if (lastWord && completion.startsWith(lastWord)) {
          completion = completion.slice(lastWord.length);
        } else if (completion.startsWith(trimmedPrefix)) {
          completion = completion.slice(trimmedPrefix.length);
        }
      }
    }
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

  if (
    (llm.model.includes("gemini") || llm.model.includes("gemma")) &&
    completion.endsWith("<|file_separator|>")
  ) {
    // "<|file_separator|>" is 18 characters long
    completion = completion.slice(0, -18);
  }

  // If prefix ends with space and so does completion, then remove the space from completion

  if (prefix.endsWith(" ") && completion.startsWith(" ")) {
    completion = completion.slice(1);
  }

  // Remove markdown code block delimiters
  completion = removeBackticks(completion);

  return completion;
}
