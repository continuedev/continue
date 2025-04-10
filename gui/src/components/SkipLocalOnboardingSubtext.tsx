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
        proceed without checks
      </span>
    </ButtonSubtext>
  );
}

export default SkipLocalOnboardingSubtext;
