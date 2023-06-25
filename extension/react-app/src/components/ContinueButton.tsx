import styled, { keyframes } from "styled-components";
import { Button } from ".";
import { Play } from "@styled-icons/heroicons-outline";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";

let StyledButton = styled(Button)`
  margin: auto;
  display: grid;
  grid-template-columns: 30px 1fr;
  align-items: center;
  background: linear-gradient(
    95.23deg,
    #be1a55 14.44%,
    rgba(203, 27, 90, 0.4) 82.21%
  );

  &:hover {
    transition-delay: 0.5s;
    transition-property: background;
    background: linear-gradient(
      45deg,
      #be1a55 14.44%,
      rgba(203, 27, 90, 0.4) 82.21%
    );
  }
`;

function ContinueButton(props: { onClick?: () => void; hidden?: boolean }) {
  const vscMediaUrl = useSelector(
    (state: RootStore) => state.config.vscMediaUrl
  );

  return (
    <StyledButton
      hidden={props.hidden}
      className="m-auto"
      onClick={props.onClick}
    >
      {vscMediaUrl ? (
        <img src={`${vscMediaUrl}/play_button.png`} width="22px" />
      ) : (
        <Play />
      )}
      Continue
    </StyledButton>
  );
}

export default ContinueButton;
