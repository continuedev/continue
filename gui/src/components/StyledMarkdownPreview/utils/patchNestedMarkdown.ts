/*
    This is a patch for outputing markdown code that contains codeblocks

    It notices markdown blocks (including GitHub-specific variants),
    keeps track of when that specific block is closed,
    and uses ~~~ instead of ``` for that block

    Note, this was benchmarked at sub-millisecond
*/
import { headerIsMarkdown } from "./headerIsMarkdown";

export const patchNestedMarkdown = (source: string): string => {
  // Early return if no markdown codeblock pattern is found (including GitHub variants)
  if (!source.match(/```(\w*|.*)(md|markdown|gfm|github-markdown)/))
    return source;

  let nestCount = 0;
  const lines = source.split("\n");
  const trimmedLines = lines.map((l) => l.trim());

  for (let i = 0; i < trimmedLines.length; i++) {
    const line = trimmedLines[i];

    if (nestCount > 0) {
      // Inside a markdown block
      if (line.match(/^`+$/)) {
        // Found bare backticks
        // Count how many bare backticks are remaining after this one
        let remainingBareBackticks = 0;
        for (let j = i + 1; j < trimmedLines.length; j++) {
          if (trimmedLines[j].match(/^`+$/)) {
            remainingBareBackticks++;
          }
        }

        // If this is the last bare backticks, it closes the markdown block
        if (remainingBareBackticks === 0) {
          nestCount = 0;
          lines[i] = "~~~"; // Convert final closing delimiter to tildes
        }
        // Otherwise, keep as backticks (inner nested block delimiter)
      } else if (line.startsWith("```")) {
        // Going into a nested codeblock (with language identifier)
        nestCount++;
      }
    } else {
      // Not inside a markdown block yet
      if (line.startsWith("```")) {
        const header = line.replaceAll("`", "");

        // Check if this is a markdown codeblock using a consolidated approach (including GitHub-specific variants)
        const isMarkdown = headerIsMarkdown(header);

        if (isMarkdown) {
          nestCount = 1;
          lines[i] = lines[i].replaceAll("`", "~");
        }
      }
    }
  }

  return lines.join("\n");
};
