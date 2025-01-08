import styled from "styled-components";
import { defaultBorderRadius, vscBackground, vscForeground } from ".";
import { CheckIcon } from "@heroicons/react/24/outline";

interface CheckDivProps {
  title: string;
  checked: boolean;
  onClick: () => void;
}

const StyledDiv = styled.div<{ checked: boolean }>`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border-radius: ${defaultBorderRadius};
  cursor: pointer;
  border: 1px solid ${vscForeground};

  color: ${vscForeground};
  background-color: ${vscBackground};

  &:hover {
    background-color: ${vscForeground};
    color: ${vscBackground};
  }
  width: fit-content;

  margin: 0.5rem;
  height: 1.4em;

  overflow: hidden;
  text-overflow: ellipsis;
`;

function CheckDiv(props: CheckDivProps) {
  const { title, checked, onClick } = props;

  return (
    <StyledDiv onClick={onClick} checked={checked}>
      {checked && <CheckIcon width="1.4em" height="1.4em" />}
      {title}
    </StyledDiv>
  );
}

export default CheckDiv;
