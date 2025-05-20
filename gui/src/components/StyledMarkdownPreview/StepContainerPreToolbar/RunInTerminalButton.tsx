import { CommandLineIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { lightGray, vscForeground } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { isJetBrains } from "../../../util";

interface RunInTerminalButtonProps {
  command: string;
}

export function RunInTerminalButton({ command }: RunInTerminalButtonProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  if (isJetBrains()) {
    // JetBrains plugin doesn't currently have a way to run the command in the terminal for the user
    return null;
  }

  // Extract just the command line (the line after $ or the first line)
  function extractCommand(cmd: string): string {
    // First handle the $ prompt case, extract the line after it
    if (cmd.includes("$")) {
      const match = cmd.match(/\$\s*([^\n]+)/);
      if (match) {
        return match[1].trim();
      }
    }

    // Process all lines, filtering out comments and empty lines
    const lines = cmd.split("\n")
      .map(line => line.trim())
      .filter(line => 
        line && 
        !line.startsWith("#") && 
        !line.startsWith("//") && 
        !line.startsWith("/*")
      );

    // Handle multi-line commands
    let result = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      result += line;
      
      // Add space for command continuation
      if (line.endsWith("&&") || line.endsWith("|") || line.endsWith("\\")) {
        result += " ";
      } else if (i < lines.length - 1) {
        result += " ";
      }
    }
    return result.trim();
  }

  function runInTerminal() {
    // Extract just the command line
    const extractedCommand = extractCommand(command);
    void ideMessenger.post("runCommand", { command: extractedCommand });
  }

  return (
    <div
      className={`text-lightgray flex items-center border-none bg-transparent text-xs text-[${vscForeground}] cursor-pointer outline-none hover:brightness-125`}
      onClick={runInTerminal}
    >
      <div
        className="max-2xs:hidden flex items-center gap-1 transition-colors duration-200 hover:brightness-125"
        style={{ color: lightGray }}
      >
        <>
          <CommandLineIcon className="h-3 w-3 hover:brightness-125" />
          <span className="text-lightgray max-sm:hidden">Run</span>
        </>
      </div>
    </div>
  );
}
