import ReactDOM from "react-dom";
import { useState, useContext } from "react";
import { CheckIcon, CommandLineIcon } from "@heroicons/react/24/outline";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscForeground,
  StyledTooltip,
  Button,
} from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";

export type CopyToTerminalButtonProps = {
  children: string;
};

export const StyledDiv = styled.div<{ clicked?: boolean }>`
  width: 100%;
  padding-left: 12px;
  padding-right: 12px;
  display: flex;
  border-radius: ${defaultBorderRadius};
  height: 32px;
  width: 100%;
  gap: 8px;
  align-items: center;
  border: 1px solid ${lightGray};
  cursor: pointer;
  font-size: 12px;
  justify-content: center;
  align-items: center;
  &:hover {
    background-color: ${({ clicked }) => (clicked ? "#0f02" : "#fff1")};
  }
  ${({ clicked }) => clicked && "background-color: #0f02;"}
`;

export const StyledButton = styled(Button)<{ blurColor?: string }>`
  background-color: transparent;
  color: ${vscForeground};
  border: 1px solid ${lightGray}cc;

  &:hover {
    border: 1px solid ${lightGray};
    background-color: ${lightGray}22;
  }
`;

export function CopyToTerminalButton(props: CopyToTerminalButtonProps) {
  const [clicked, setClicked] = useState(false);

  const id = `info-hover-${encodeURIComponent(props.children)}`;
  const tooltipPortalDiv = document.getElementById("tooltip-portal-div");

  const ideMessenger = useContext(IdeMessengerContext);

  return (
    <>
      <div className="flex items-center justify-end" data-tooltip-id={id}>
        <StyledDiv
          clicked={clicked}
          className="grid-cols-2"
          onClick={() => {
            ideMessenger.ide.runCommand(props.children);
            setClicked(true);
            setTimeout(() => setClicked(false), 2000);
            ideMessenger.post("copyText", { text: props.children });
          }}
        >
          {clicked ? (
            <CheckIcon width="20px" height="20px" className="text-green-700" />
          ) : (
            <CommandLineIcon width="20px" height="20px" />
          )}

          <pre>
            <code
              style={{
                color: vscForeground,
                backgroundColor: "transparent",
              }}
            >
              {props.children}
            </code>
          </pre>
        </StyledDiv>
      </div>
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
