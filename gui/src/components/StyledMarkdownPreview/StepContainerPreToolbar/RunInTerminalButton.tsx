import { CommandLineIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { lightGray, vscForeground } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch } from "../../../redux/hooks";
import { callCurrentTool } from "../../../redux/thunks";
import { isJetBrains } from "../../../util";
import { extractCommand } from "../utils/commandExtractor";
interface RunInTerminalButtonProps {
  command: string;
  ideHasEditor?: boolean;
}

export function RunInTerminalButton({ command, ideHasEditor }: RunInTerminalButtonProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();

  if (isJetBrains()) {
    // JetBrains plugin doesn't currently have a way to run the command in the terminal for the user
    return null;
  }

  function runInTerminal() {
    if (!ideHasEditor) {
      dispatch(callCurrentTool());
      return;
    }
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
