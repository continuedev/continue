import { ButtonSubtext } from ".";

export interface SkipLocalOnboardingSubtextProps {
    onClick: () => void
}

function SkipLocalOnboardingSubtext({
    onClick,
}: SkipLocalOnboardingSubtextProps) {
  return (
    <ButtonSubtext>
      <span
        className="cursor-pointer underline"
        onClick={onClick}
      >
        proceed without completing this step
      </span>
    </ButtonSubtext>
  );
}

export default SkipLocalOnboardingSubtext;
