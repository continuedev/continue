import ReactDOM from "react-dom";
import { CommandLineIcon } from "@heroicons/react/24/outline";
import { StyledTooltip } from "../..";
import { useContext } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";

export type CopyToTerminalButtonProps = {
  command: string;
};

export function CopyToTerminalButton({ command }: CopyToTerminalButtonProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const id = `info-hover-${encodeURIComponent(command)}`;
  const tooltipPortalDiv = document.getElementById("tooltip-portal-div");

  function onClick() {
    ideMessenger.ide.runCommand(command);
    ideMessenger.post("copyText", { text: command });
  }

  return (
    <>
      <CommandLineIcon
        className="cursor-pointer"
        width={24}
        height={24}
        onClick={onClick}
        data-tooltip-id={id}
      />
      {tooltipPortalDiv &&
        ReactDOM.createPortal(
          <StyledTooltip id={id} place="top">
            Copy into terminal
          </StyledTooltip>,
          tooltipPortalDiv,
        )}
    </>
  );
}
