import styled from "styled-components";
import { Button } from ".";
import { PlayIcon } from "@heroicons/react/24/outline";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import { useEffect, useState } from "react";

const StyledButton = styled(Button)<{
  color?: string | null;
  isDisabled: boolean;
}>`
  margin: auto;
  margin-top: 8px;
  margin-bottom: 16px;
  display: grid;
  grid-template-columns: 22px 1fr;
  align-items: center;
  background-color: ${(props) => props.color || "#be1b55"};

  opacity: ${(props) => (props.isDisabled ? 0.5 : 1.0)};

  cursor: ${(props) => (props.isDisabled ? "default" : "pointer")};

  &:hover:enabled {
    background-color: ${(props) => props.color || "#be1b55"};
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
}) {
  const vscMediaUrl = useSelector(
    (state: RootStore) => state.config.vscMediaUrl
  );

  const [buttonColor, setButtonColor] = useState<string | null>(
    localStorage.getItem("continueButtonColor")
  );

  useEffect(() => {
    const handleStorageChange = (e: any) => {
      if (e.key === "continueButtonColor") {
        // Update your state or do whatever you need to do here
        setButtonColor(e.newValue);
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Don't forget to cleanup the event listener
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return (
    <StyledButton
      color={buttonColor as any}
      hidden={props.hidden}
      style={{ fontSize: "10px" }}
      className="m-auto press-start-2p"
      onClick={props.disabled ? undefined : props.onClick}
      isDisabled={props.disabled}
    >
      {vscMediaUrl ? (
        <img src={`${vscMediaUrl}/play_button.png`} width="16px" />
      ) : (
        <PlayIcon />
      )}
      CONTINUE
    </StyledButton>
  );
}

export default ContinueButton;
