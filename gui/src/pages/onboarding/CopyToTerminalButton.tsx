import ReactDOM from "react-dom";
import { useState, useContext } from "react";
import { CheckIcon, CommandLineIcon } from "@heroicons/react/24/outline";
import styled from "styled-components";
import {
  StyledTooltip,
  defaultBorderRadius,
  lightGray,
  vscForeground,
} from "../../components";
import { IdeMessengerContext } from "../../context/IdeMessenger";

export type CopyToTerminalButtonProps = {
  children: string;
};

const StyledDiv = styled.div<{ clicked: boolean }>`
  padding-left: 8px;
  padding-right: 8px;
  display: flex;
  border-radius: ${defaultBorderRadius};
  width: fit-content;
  gap: 8px;

  ${({ clicked }) => clicked && "background-color: #0f02;"}

  align-items: center;

  border: 1px solid ${lightGray};

  cursor: pointer;
  &:hover {
    background-color: ${({ clicked }) => (clicked ? "#0f02" : "#fff1")};
  }
`;

export function CopyToTerminalButton(props: CopyToTerminalButtonProps) {
  const [clicked, setClicked] = useState(false);

  const id = `info-hover-${encodeURIComponent(props.children)}`;
  const tooltipPortalDiv = document.getElementById("tooltip-portal-div");

  const ideMessenger = useContext(IdeMessengerContext);

  return (
    <>
      <div
        className="flex items-center justify-center mt-8"
        data-tooltip-id={id}
      >
        <StyledDiv
          clicked={clicked}
          style={{ border: `0.5px solid ${lightGray}` }}
          className="grid-cols-2"
          onClick={() => {
            ideMessenger.ide.runCommand(props.children);
            setClicked(true);
            setTimeout(() => setClicked(false), 2000);
            ideMessenger.post("copyText", { text: props.children });
          }}
        >
          {clicked ? (
            <CheckIcon
              width="20px"
              height="20px"
              className="cursor-pointer hover:bg-white"
              color="#0b0"
            />
          ) : (
            <CommandLineIcon
              width="20px"
              height="20px"
              className="cursor-pointer hover:bg-white"
            />
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
            Copy to terminal
          </StyledTooltip>,
          tooltipPortalDiv,
        )}
    </>
  );
}
