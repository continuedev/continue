import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { defaultBorderRadius, lightGray } from ".";
import styled from "styled-components";

interface LinkButtonProps {
  onClick: () => void;
  url: string;
}

const StyledLinkButton = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: background-color 200ms;
  border-radius: ${defaultBorderRadius};
  padding: 2px 12px;
  background-color: ${lightGray}33;
  background-opacity: 0.1;
`;

function LinkButton({ onClick, url }: LinkButtonProps) {
  return (
    <StyledLinkButton onClick={onClick}>
      <p className="underline text-sm">{url}</p>
      <ArrowTopRightOnSquareIcon width={24} height={24} />
    </StyledLinkButton>
  );
}

export default LinkButton;
