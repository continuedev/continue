// Rename the product name "Continue" -> "Continued" in user-visible text only.
// Keeps functional identifiers untouched: continue.* command/setting IDs, the
// ~/.continue config directory, .continueignore, continue_tutorial.py, package
// names, URLs and the upstream Continue.continue extension ID.
// Run from the repository root:  node brand-src/rename-product.js [--write]
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const WRITE = process.argv.includes("--write");

// Only these files: user-visible strings the extension and GUI show.
const FILES = [
  "extensions/vscode/src/ContinueConsoleWebviewViewProvider.ts",
  "extensions/vscode/src/ContinueGUIWebviewViewProvider.ts",
  "extensions/vscode/src/activation/activate.ts",
  "extensions/vscode/src/extension.ts",
  "extensions/vscode/src/lang-server/codeLens/providers/DownloadYamlExtensionCodeLensProvider.ts",
  "extensions/vscode/src/util/ideUtils.ts",
  "extensions/vscode/src/webviewProtocol.ts",
  "gui/src/components/dialogs/FeedbackDialog.tsx",
  "gui/src/pages/config/features/indexing/IndexingProgress.tsx",
  "gui/src/pages/config/features/keyboard/KeyboardShortcuts.tsx",
  "gui/src/pages/config/sections/HelpSection.tsx",
  "gui/src/pages/config/sections/UserSettingsSection.tsx",
  "gui/src/pages/gui/ToolCallDiv/MCPAppRenderer.tsx",
  "gui/src/pages/gui/ToolCallDiv/ToolCallStatusMessage.tsx",
  "gui/index.html",
];

// "Continue" as a whole word that is the product name: not followed by a
// dot/underscore/hyphen identifier suffix, and not part of a URL or package.
const PRODUCT = /(?<![\w./@:-])Continue(?![\w-])(?!\.(?:[a-z]|continue))/g;
const SKIP_LINE =
  /https?:\/\/|continuedev|continue\.dev|\bcontinue\.[a-z]|\.continue|Continue\.continue/;

let total = 0;
for (const rel of FILES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.log(`missing ${rel}`);
    continue;
  }
  const before = fs.readFileSync(file, "utf8").split("\n");
  let count = 0;
  const after = before.map((line) => {
    if (SKIP_LINE.test(line)) return line;
    return line.replace(PRODUCT, () => {
      count++;
      return "Continued";
    });
  });
  if (count > 0) {
    total += count;
    console.log(`${count}\t${rel}`);
    if (WRITE) fs.writeFileSync(file, after.join("\n"));
  }
}
console.log(`${WRITE ? "wrote" : "would change"} ${total} occurrence(s)`);
