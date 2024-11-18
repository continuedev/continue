/*
    This is a patch for outputing markdown code that contains codeblocks

    It notices markdown blocks, keeps track of when that specific block is closed,
    and uses ~~~ instead of ``` for that block

    Note, this was benchmarked at sub-millisecond

      // TODO support github-specific markdown as well, edge case
*/

export const patchNestedMarkdown = (source: string): string => {
  if (!source.match(/```(md|markdown)/)) return source; // For performance
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
      if (line.startsWith("```md") || line.startsWith("```markdown")) {
        nestCount = 1;
        lines[i] = lines[i].replace(/```(md|markdown)/, "~~~"); // Replace backticks with tildes
      }
    }
  }
  const out = lines.join("\n");
  // console.log(`patched in ${Date.now() - start}ms`);
  return out;
};

// This version tries to detect if a codeblock without a language specified is a starter codeblock
// It tries again if didn't come back to root nesting, without checking for that ^
// I didn't use for performance and also because the root nest check doesn't make sense mid-generation

// export const patchNestedMarkdown = (source: string): string => {
//   const start = Date.now();

//   let attempts = 0;

//   while (attempts <= 2) {
//     let nestCount = 0;
//     const lines = source.split("\n");
//     const trimmedLines = lines.map((l) => l.trim());
//     for (let i = 0; i < trimmedLines.length; i++) {
//       const line = trimmedLines[i];
//       if (nestCount) {
//         if (line.match(/^`+$/)) {
//           if (attempts === 0 && i !== lines.length && lines[i + 1] !== "") {
//             nestCount++;
//             continue;
//           }
//           if (nestCount === 1) lines[i] = "~~~";
//           nestCount--;
//         } else if (line.startsWith("```")) {
//           // Going into a nested codeblock
//           nestCount++;
//         }
//       } else {
//         // Enter the markdown block, start tracking nesting
//         if (line.startsWith("```md") || line.startsWith("```markdown")) {
//           nestCount = 1;
//           lines[i] = lines[i].replace(/^```(md|markdown)/, "~~~"); // Replace backticks with tildes
//         }
//       }
//     }
//     if (nestCount === 0) {
//       console.log(
//         `patch successful in ${Date.now() - start} ms with ${attempts} attempts`,
//       );
//       return lines.join("\n");
//     }
//     attempts++;
//   }

//   console.log(
//     `patch failed in ${Date.now() - start} ms with ${attempts} attempts`,
//   );
//   return source;
// };
