import { CommandLineIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { lightGray, vscForeground } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";

interface RunInTerminalButtonProps {
  command: string;
}

export default function RunInTerminalButton({
  command,
}: RunInTerminalButtonProps) {
  const ideMessenger = useContext(IdeMessengerContext);

  function runInTerminal() {
    void ideMessenger.post("runCommand", { command });
  }

  return (
    <div
      className={`flex items-center border-none bg-transparent text-xs text-gray-400 text-[${vscForeground}] cursor-pointer outline-none hover:brightness-125`}
      onClick={runInTerminal}
    >
      <div
        className="max-2xs:hidden flex items-center gap-1 transition-colors duration-200 hover:brightness-125"
        style={{ color: lightGray }}
      >
        <>
          <CommandLineIcon className="h-3 w-3 hover:brightness-125" />
          <span className="text-gray-400 max-sm:hidden">Run</span>
        </>
      </div>
    </div>
  );
}
