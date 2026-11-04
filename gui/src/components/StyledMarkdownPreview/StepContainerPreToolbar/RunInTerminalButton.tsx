import { CommandLineIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { lightGray, vscForeground } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { extractCommand } from "../utils/commandExtractor";

interface RunInTerminalButtonProps {
  command: string;
}

export function RunInTerminalButton({ command }: RunInTerminalButtonProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  function runInTerminal() {
    // Extract just the command line
    const extractedCommand = extractCommand(command);
    void ideMessenger.post("runCommand", { command: extractedCommand });
  }

  return (
    <div
      className={`flex items-center border-none bg-transparent text-xs text-lightgray text-[${vscForeground}] cursor-pointer outline-hidden hover:brightness-125`}
      onClick={runInTerminal}
    >
      <div
        className="flex items-center gap-1 transition-colors duration-200 hover:brightness-125 max-2xs:hidden"
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
