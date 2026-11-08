import {
  actTurnFor,
  IDE_TURN_TOOL_NAMES,
  planTurnFor,
} from "./prompts/turns.js";

export const DEFAULT_SYSTEM_MESSAGES_URL =
  "https://github.com/b1tninja/continuous/blob/main/core/llm/defaultSystemMessages.ts";

export const CODEBLOCK_FORMATTING_INSTRUCTIONS = `\
  Always include the language and file name in the info string when you write code blocks.
  If you are editing "src/main.py" for example, your code block should start with '\`\`\`python src/main.py'
`;

export const EDIT_CODE_INSTRUCTIONS = `\
  When addressing code modification requests, present a concise code snippet that
  emphasizes only the necessary changes and uses abbreviated placeholders for
  unmodified sections. For example:

  \`\`\`language /path/to/file
  // ... existing code ...

  {{ modified code here }}

  // ... existing code ...

  {{ another modification }}

  // ... rest of code ...
  \`\`\`

  In existing files, you should always restate the function or class that the snippet belongs to:

  \`\`\`language /path/to/file
  // ... existing code ...

  function exampleFunction() {
    // ... existing code ...

    {{ modified code here }}

    // ... rest of function ...
  }

  // ... rest of code ...
  \`\`\`

  Since users have access to their complete file, they prefer reading only the
  relevant modifications. It's perfectly acceptable to omit unmodified portions
  at the beginning, middle, or end of files using these "lazy" comments. Only
  provide the complete file when explicitly requested. Include a concise explanation
  of changes unless the user specifically asks for code only.
`;

const BRIEF_LAZY_INSTRUCTIONS = `For larger codeblocks (>20 lines), use brief language-appropriate placeholders for unmodified sections, e.g. '// ... existing code ...'`;

export const DEFAULT_CHAT_SYSTEM_MESSAGE = `\
<important_rules>
  You are in chat mode.

  If the user asks to make changes to files offer that they can use the Apply Button on the code block, or switch to Agent Mode to make the suggested updates automatically.
  If needed concisely explain to the user they can switch to agent mode using the Mode Selector dropdown and provide no other details.

${CODEBLOCK_FORMATTING_INSTRUCTIONS}
${EDIT_CODE_INSTRUCTIONS}
</important_rules>`;

/**
 * The act turn's instructions (core/llm/prompts/turns.ts), shared with the
 * CLI, plus the IDE's code-block rules. A Loop item run uses the same text.
 * `model` picks the turn text by prompt profile (short for Qwen).
 */
export function agentSystemMessageFor(model?: string): string {
  return `\
<important_rules>
${actTurnFor(model, IDE_TURN_TOOL_NAMES)}

${CODEBLOCK_FORMATTING_INSTRUCTIONS}
${BRIEF_LAZY_INSTRUCTIONS}
Code blocks are for showing options. Make changes with the edit tools.
</important_rules>`;
}

export const DEFAULT_AGENT_SYSTEM_MESSAGE = agentSystemMessageFor();

/**
 * The plan turn's instructions, shared with the CLI, plus the IDE's code-block
 * rules. Plan mode offers only read-only tools (selectActiveTools), so the
 * text states the limit rather than asking the model to keep it. A Loop
 * re-plan uses the same text. `model` picks the text by prompt profile.
 */
export function planSystemMessageFor(model?: string): string {
  return `\
<important_rules>
${planTurnFor(model, IDE_TURN_TOOL_NAMES)}

${CODEBLOCK_FORMATTING_INSTRUCTIONS}
${BRIEF_LAZY_INSTRUCTIONS}
Code blocks here show what a change would look like. They are not edits.
</important_rules>`;
}

export const DEFAULT_PLAN_SYSTEM_MESSAGE = planSystemMessageFor();
