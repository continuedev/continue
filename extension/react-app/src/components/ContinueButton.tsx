import styled, { keyframes } from "styled-components";
import { Button } from ".";
import { Play } from "@styled-icons/heroicons-outline";

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

function ContinueButton(props: { onClick?: () => void }) {
  return (
    <StyledButton className="m-auto" onClick={props.onClick}>
      <Play />
      {/* <img src={"/continue_arrow.png"} width="16px"></img> */}
      Continue
    </StyledButton>
  );
}

export default ContinueButton;
