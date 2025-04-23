import { CommandLineIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { lightGray, vscForeground } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";

interface RunInTerminalButtonProps {
  command: string;
}

export function RunInTerminalButton({ command }: RunInTerminalButtonProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  // Extract just the command line (the line after $ or the first line)
  function extractCommand(cmd: string): string {
    // If the command contains a $ prompt, extract the line after it
    if (cmd.includes('$')) {
      const match = cmd.match(/\$\s*([^\n]+)/);
      return match ? match[1].trim() : '';
    }
    
    // Otherwise, just take the first line
    return cmd.split('\n')[0].trim();
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
