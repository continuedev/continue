export function parseOtelHeaders(headersStr: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!headersStr) return headers;

  headersStr.split(",").forEach((header) => {
    const [key, value] = header.split("=");
    if (key && value) {
      headers[key.trim()] = value.trim();
    }
  });

  return headers;
}

export function detectTerminalType(): string | undefined {
  if (process.env.TERM_PROGRAM) {
    return process.env.TERM_PROGRAM;
  }
  if (process.env.VSCODE_PID) {
    return "vscode";
  }
  if (process.env.TMUX) {
    return "tmux";
  }
  return undefined;
}
