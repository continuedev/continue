/*
    This is a patch for outputing markdown code that contains codeblocks

    It notices markdown blocks, keeps track of when that specific block is closed,
    and uses ~~~ instead of ``` for that block

    Note, this was benchmarked at sub-millisecond

      // TODO support github-specific markdown as well, edge case
*/
export const patchNestedMarkdown = (source: string): string => {
  if (!source.match(/```(\w+\.(md|markdown))/)) return source; // For performance
  // const start = Date.now();
  let nestCount = 0;
  const lines = source.split("\n");
  const trimmedLines = lines.map((l) => l.trim());
  for (let i = 0; i < trimmedLines.length; i++) {
    const line = trimmedLines[i];
    if (nestCount) {
      if (line.match(/^`+$/)) {
        // Ending a block
        if (nestCount === 1) lines[i] = "~~~"; // End of markdown block
        nestCount--;
      } else if (line.startsWith("```")) {
        // Going into a nested codeblock
        nestCount++;
      }
    } else {
      // Enter the markdown block, start tracking nesting
      if (line.startsWith("```")) {
        const header = line.replaceAll("`", "");
        const file = header.split(" ")[0];

        if (file) {
          const ext = file.split(".").at(-1);
          if (ext === "md" || ext === "markdown") {
            nestCount = 1;
            lines[i] = lines[i].replaceAll("`", "~"); // Replace backticks with tildes
          }
        }
      }
    }
  }
  const out = lines.join("\n");
  // console.log(`patched in ${Date.now() - start}ms`);
  return out;
};
