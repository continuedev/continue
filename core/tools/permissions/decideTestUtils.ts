import { DecideInput, decideToolCall } from "./decide";
import { parseToolPermissions } from "./rules";

export const ASK = "allowedWithPermission" as const;
export const ALLOW = "allowedWithoutPermission" as const;
export const OFF = "disabled" as const;

export function decide(
  perms: Parameters<typeof parseToolPermissions>[0],
  over: Partial<DecideInput> & Pick<DecideInput, "toolName" | "parsedArgs">,
) {
  return decideToolCall({
    base: ASK,
    evaluated: ASK,
    rules: parseToolPermissions(perms),
    ...over,
  });
}

export const term = (command: string) => ({
  toolName: "run_terminal_command",
  parsedArgs: { command },
});

export const read = (filepath: string) => ({
  toolName: "read_file",
  parsedArgs: { filepath },
});
