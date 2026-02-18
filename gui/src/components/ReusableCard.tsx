import { XMarkIcon } from "@heroicons/react/24/outline";
import styled from "styled-components";
import { CloseButton, defaultBorderRadius, vscInputBackground } from ".";

const StyledCard = styled.div`
  margin: auto;
  border-radius: ${defaultBorderRadius};
  background-color: ${vscInputBackground};
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 0.1),
    0 8px 10px -6px rgb(0 0 0 / 0.1);
`;

interface ReusableCardProps {
  children: React.ReactNode;
  showCloseButton?: boolean;
  onClose?: () => void;
  className?: string;
  testId?: string;
}

export function ReusableCard({
  children,
  showCloseButton,
  onClose,
  className = "",
  testId,
}: ReusableCardProps) {
  return (
    <StyledCard
      className={`xs:py-4 xs:px-4 relative px-2 !pt-0 pb-3 ${className}`}
      data-testid={testId}
    >
      {showCloseButton && (
        <CloseButton onClick={onClose}>
          <XMarkIcon className="flex h-5 w-5 hover:brightness-125" />
        </CloseButton>
      )}
      <div className="content">{children}</div>
    </StyledCard>
  );
}
