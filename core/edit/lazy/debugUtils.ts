/**
 * Utility functions for formatting debug messages that help developers
 * create test cases from lazy edit failures
 */

export function formatDeterministicFailureMessage(
  error: unknown,
  oldFile: string,
  newLazyFile: string,
): string {
  return `
========== DETERMINISTIC LAZY EDIT FAILURE ==========
Please help create a test case for this failure:

Error: ${error instanceof Error ? error.message : String(error)}

ORIGINAL FILE:
---
${oldFile}
---

LLM GENERATED FILE:
---
${newLazyFile}
---

PROMPT FOR LLM:
Please create a test-example diff file with the above content in this format:
[original file content]
---
[llm generated content]
---
[expected diff lines starting with + or -]

Save as: core/edit/lazy/test-examples/[descriptive-name].diff
===============================================`;
}

export function formatUnifiedDiffFailureMessage(
  error: unknown,
  oldFile: string,
  unifiedDiffInput: string,
): string {
  return `
========== UNIFIED DIFF FAILURE ==========
Please help create a test case for this unified diff failure:

Error: ${error instanceof Error ? error.message : String(error)}

ORIGINAL FILE:
---
${oldFile}
---

UNIFIED DIFF INPUT:
---
${unifiedDiffInput}
---

PROMPT FOR LLM:
The unified diff format failed to apply. Please create a test-example diff file:
[original file content]
---
[corrected version of the file]
---
[expected diff lines starting with + or -]

Save as: core/edit/lazy/test-examples/unified-diff-[descriptive-name].diff
===============================================`;
}
