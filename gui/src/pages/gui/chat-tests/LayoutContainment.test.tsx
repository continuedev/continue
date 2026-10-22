import { act, waitFor } from "@testing-library/react";
import { ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import GUI from "..";
import {
  ChatHistoryItemWithMessageId,
  newSession,
} from "../../../redux/slices/sessionSlice";
import { renderWithProviders } from "../../../util/test/render";

/*
 * Very large responses and tool output used to widen the chat column past the
 * webview, where the GUI wrapper clipped it (along with the input controls).
 * jsdom has no layout engine, so these tests pin the CSS contracts that keep
 * such content contained: a chat column that can shrink below its content's
 * min-content width, and code, terminal output and tables that scroll within
 * themselves. Rendered dimensions must be checked in a real browser/webview.
 */

const LONG_TOKEN = "x".repeat(6000);
const LONG_PATH = `/home/user/${Array.from(
  { length: 30 },
  (_, i) => `very_long_directory_name_${i}`,
).join("/")}/index.ts`;
const LONG_URL = `https://example.com/${"segment/".repeat(80)}`;
const LONG_CODE_BLOCK = [
  "```typescript",
  ...Array.from(
    { length: 20 },
    (_, i) => `const line${i} = "${"y".repeat(400)}"; // ${LONG_PATH}`,
  ),
  "```",
].join("\n");
const WIDE_TABLE = [
  `| ${Array.from({ length: 24 }, (_, i) => `Column ${i}`).join(" | ")} |`,
  `|${Array.from({ length: 24 }, () => "---").join("|")}|`,
  `| ${Array.from({ length: 24 }, () => LONG_PATH).join(" | ")} |`,
].join("\n");
const TERMINAL_COMMAND = `npx vitest run ${LONG_PATH}`;
const TERMINAL_OUTPUT = Array.from(
  { length: 40 },
  (_, i) => `  at Object.<anonymous> (${LONG_PATH}:${i}:12) ${LONG_TOKEN}`,
).join("\n");

const terminalToolCallState: ToolCallState = {
  toolCallId: "terminal-call",
  toolCall: {
    id: "terminal-call",
    type: "function",
    function: {
      name: BuiltInToolNames.RunTerminalCommand,
      arguments: JSON.stringify({ command: TERMINAL_COMMAND }),
    },
  },
  status: "done",
  parsedArgs: { command: TERMINAL_COMMAND },
  output: [
    {
      name: "Terminal",
      description: "Terminal command output",
      content: TERMINAL_OUTPUT,
    },
  ],
};

const LONG_CONVERSATION: ChatHistoryItemWithMessageId[] = [
  {
    message: { role: "user", content: `Check ${LONG_TOKEN}`, id: "user-1" },
    contextItems: [
      {
        id: { providerTitle: "url", itemId: "url-item" },
        name: "Docs",
        description: LONG_URL,
        content: "docs",
        uri: { type: "url", value: LONG_URL },
      },
    ],
  },
  {
    message: {
      role: "assistant",
      content: `Prose ${LONG_TOKEN}\n\n${LONG_CODE_BLOCK}\n\n${WIDE_TABLE}\n\nPath: ${LONG_PATH}`,
      id: "assistant-1",
    },
    contextItems: [],
  },
  {
    message: { role: "assistant", content: "", id: "assistant-2" },
    contextItems: [],
    toolCallStates: [terminalToolCallState],
  },
  {
    message: {
      role: "tool",
      content: TERMINAL_OUTPUT,
      toolCallId: "terminal-call",
      id: "tool-1",
    },
    contextItems: [],
  },
];

async function renderLongConversation() {
  const result = await renderWithProviders(<GUI />);
  await act(async () => {
    result.store.dispatch(
      newSession({
        sessionId: "layout-containment",
        title: "Layout containment",
        workspaceDirectory: "",
        history: LONG_CONVERSATION,
      }),
    );
  });
  await waitFor(() => {
    expect(document.querySelector("main table")).not.toBeNull();
    expect(
      document.querySelector('[data-testid="terminal-container"] pre'),
    ).not.toBeNull();
  });
}

function getMain() {
  const main = document.querySelector("main");
  expect(main).not.toBeNull();
  return main!;
}

test("chat column can shrink below the min-content width of long content", async () => {
  await renderLongConversation();

  // A flex item defaults to min-width: auto, i.e. it grows to fit its widest
  // descendant (a long code line, an unbroken token) instead of the webview
  expect(getMain()).toHaveClass("flex-1", "min-w-0");
});

test("code blocks with long lines scroll inside the code block", async () => {
  await renderLongConversation();

  const codeBlock = Array.from(getMain().querySelectorAll("pre")).find((pre) =>
    pre.textContent?.includes("const line0"),
  );
  expect(codeBlock).toBeDefined();

  const style = getComputedStyle(codeBlock!);
  expect(["auto", "scroll"]).toContain(style.overflowX);
  // Sized against the chat column, not the viewport (the history sidebar or
  // surrounding padding make the column narrower than 100vw)
  expect(style.maxWidth).not.toContain("vw");
});

test("terminal output wraps and scrolls inside the terminal block", async () => {
  await renderLongConversation();

  const terminalPre = document.querySelector(
    '[data-testid="terminal-container"] pre',
  )!;
  expect(terminalPre.textContent).toContain(LONG_PATH);

  const style = getComputedStyle(terminalPre);
  expect(style.whiteSpace).toBe("pre-wrap");
  expect(["auto", "scroll"]).toContain(style.overflowX);
  expect(style.maxWidth).not.toContain("vw");
});

test("wide markdown tables scroll inside their own container", async () => {
  await renderLongConversation();

  const table = getMain().querySelector("table")!;
  expect(table.querySelectorAll("th")).toHaveLength(24);
  expect(table.parentElement).toHaveClass("overflow-x-auto");
});

test("long context item descriptions are clipped instead of widening the row", async () => {
  await renderLongConversation();

  const [urlItem] = Array.from(
    document.querySelectorAll('[data-testid="context-items-peek-item"]'),
  );
  expect(urlItem).toBeDefined();

  const description = Array.from(urlItem.children).find((child) =>
    child.textContent?.includes(LONG_URL),
  );
  expect(description).toHaveClass("min-w-0");
});

test("main input height leaves room for its toolbar in short panels", async () => {
  await renderLongConversation();

  const editorScroller = document.querySelector(
    '[data-testid="editor-input-main"]',
  )?.parentElement;
  expect(editorScroller).toBeDefined();
  // A plain 70vh cap plus the input chrome overflows a short bottom panel and
  // hides the send button; the cap must also depend on the full panel height
  expect(editorScroller!.className).toMatch(/max-h-\[[^\]]*100vh[^\]]*\]/);
});
