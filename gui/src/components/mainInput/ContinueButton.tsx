import { PlayIcon, StopIcon } from "@heroicons/react/24/outline";
import styled from "styled-components";
import { Button } from "..";
import { getFontSize } from "../../util";

const StyledButton = styled(Button)<{
  color?: string | null;
  isDisabled: boolean;
  showStop: boolean;
}>`
  margin: auto;
  margin-top: 8px;
  margin-bottom: 16px;
  display: grid;
  width: 130px;
  grid-template-columns: 22px 1fr;
  align-items: center;
  background-color: ${(props) =>
    `${props.color || "#be1b55"}${props.showStop ? "33" : ""}`};

  opacity: ${(props) => (props.isDisabled ? 0.5 : 1.0)};

  border: 1px solid
    ${(props) => (props.showStop ? props.color || "#be1b55" : "transparent")};

  cursor: ${(props) => (props.isDisabled ? "default" : "pointer")};

  &:hover:enabled {
    background-color: ${(props) =>
      `${props.color || "#be1b55"}${props.showStop ? "33" : ""}`};
    ${(props) =>
      props.isDisabled
        ? "cursor: default;"
        : `
      opacity: 0.7;
      `}
  }
`;

function ContinueButton(props: {
  onClick?: () => void;
  hidden?: boolean;
  disabled: boolean;
  showStop: boolean;
}) {
  return (
    <StyledButton
      showStop={props.showStop}
      hidden={props.hidden}
      style={{ fontSize: `${getFontSize() - 4}px` }}
      className="m-auto"
      onClick={props.disabled ? undefined : props.onClick}
      isDisabled={props.disabled}
    >
      {props.showStop ? (
        <>
          <StopIcon width="18px" height="18px" />
          STOP
        </>
      ) : (
        <>
          {window.vscMediaUrl ? (
            <img src={`${window.vscMediaUrl}/play_button.png`} height="18px" />
          ) : (
            <PlayIcon width="18px" height="18px" />
          )}
          CONTINUE
        </>
      )}
    </StyledButton>
  );
}

export default ContinueButton;
