import type { ILLM } from "..";

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

  return completion;
}
