const terminalLanguages = ["bash", "sh"];
const commonTerminalCommands = [
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "deno",
  "npx",
  "cd",
  "ls",
  "pwd",
  "pip",
  "python",
  "node",
  "git",
  "curl",
  "wget",
  "rbenv",
  "gem",
  "ruby",
  "bundle",
];

export function getTerminalCommand(text: string): string {
  return text.startsWith("$ ") ? text.slice(2) : text;
}

export function isTerminalCodeBlock(
  language: string | undefined,
  text: string,
) {
  return (
    terminalLanguages.includes(language) ||
    ((!language || language?.length === 0) &&
      (text.trim().split("\n").length === 1 ||
        commonTerminalCommands.some((c) => text.trim().startsWith(c))))
  );
}

function childToText(child: any) {
  if (typeof child === "string") {
    return child;
  } else if (child?.props) {
    return childToText(child.props?.children);
  } else if (Array.isArray(child)) {
    return childrenToText(child);
  } else {
    return "";
  }
}

export function childrenToText(children: any) {
  return children.map((child: any) => childToText(child)).join("");
}
