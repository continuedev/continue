export function safeParseArgs(
  args: string | undefined,
  errorId?: string,
): Record<string, any> {
  try {
    return JSON.parse(args?.trim() || "{}");
  } catch (e) {
    const identifier = errorId ? `Call: ${errorId}\nArgs:${args}\n` : "";
    console.error(
      `Failed to parse tool call arguments\n${identifier}Error:`,
      e,
    );
    return {};
  }
}
