#!/usr/bin/env node

/**
 * Annotates a git diff with GitHub API positions
 *
 * Takes a raw diff and adds [POS:N] markers with the correct
 * GitHub API positions (cumulative, with +1 between hunks)
 */

const fs = require("fs");

function annotateDiff(diffContent) {
  const lines = diffContent.split("\n");
  const output = [];
  let githubPos = 0;
  let inHunk = false;

  for (const line of lines) {
    // Handle new file - reset position counter
    if (line.startsWith("diff --git")) {
      githubPos = 0;
      inHunk = false;
      output.push(line);
      continue;
    }

    // Pass through other git headers unchanged
    if (
      line.startsWith("index ") ||
      line.startsWith("---") ||
      line.startsWith("+++") ||
      line.startsWith("rename ") ||
      line.startsWith("similarity ") ||
      line.startsWith("new file") ||
      line.startsWith("deleted file") ||
      line.startsWith("old mode") ||
      line.startsWith("new mode") ||
      line.startsWith("Binary files")
    ) {
      output.push(line);
      continue;
    }

    // Handle hunk headers
    if (line.startsWith("@@")) {
      if (inHunk) {
        githubPos++; // GitHub's +1 between hunks
      }
      inHunk = true;
      output.push(line);
      continue;
    }

    // Handle "no newline" marker - it counts as a position but isn't annotated
    if (line.startsWith("\\ No newline")) {
      if (inHunk) {
        githubPos++; // GitHub counts this as a position
      }
      output.push(line); // Don't annotate it
      continue;
    }

    // Annotate actual diff lines with GitHub positions
    if (inHunk) {
      githubPos++;
      output.push(`[POS:${githubPos}] ${line}`);
    } else {
      output.push(line);
    }
  }

  return output.join("\n");
}

// Main
function main() {
  // Read diff from stdin or file
  let input = "";

  if (process.argv.length > 2) {
    // Read from file
    input = fs.readFileSync(process.argv[2], "utf8");
  } else {
    // Read from stdin
    input = fs.readFileSync(0, "utf8");
  }

  const annotated = annotateDiff(input);
  console.log(annotated);
}

if (require.main === module) {
  main();
}

module.exports = { annotateDiff };
