import styled, { keyframes } from "styled-components";
import { Button } from ".";
import { PlayIcon } from "@heroicons/react/24/outline";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";

let StyledButton = styled(Button)`
  margin: auto;
  margin-top: 8px;
  display: grid;
  grid-template-columns: 30px 1fr;
  align-items: center;
  background: #be1b55;

  &:hover {
    transition-property: "background";
    opacity: 0.7;
  }
`;

function ContinueButton(props: { onClick?: () => void; hidden?: boolean }) {
  const vscMediaUrl = useSelector(
    (state: RootStore) => state.config.vscMediaUrl
  );

  return (
    <StyledButton
      hidden={props.hidden}
      style={{ fontSize: "10px" }}
      className="m-auto press-start-2p"
      onClick={props.onClick}
    >
      {vscMediaUrl ? (
        <img src={`${vscMediaUrl}/play_button.png`} width="22px" />
      ) : (
        <PlayIcon />
      )}
      CONTINUE
    </StyledButton>
  );
}

export default ContinueButton;
