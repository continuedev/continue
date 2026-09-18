import { SecondaryButton } from "../..";
import RuckusLogo from "../../svg/RuckusLogo";

export function OnboardingCardLanding({
  onSelectConfigure,
  isDialog,
}: {
  onSelectConfigure: () => void;
  isDialog?: boolean;
}) {
  return (
    <div className="xs:px-0 max-full flex w-full flex-col items-center justify-center px-4 text-center">
      <div className="xs:flex hidden">
        <RuckusLogo height={44} />
      </div>

      <p className="mb-5 mt-0 w-full text-sm">
        Get started with AI-powered coding through Vercel AI Gateway
      </p>

      <SecondaryButton onClick={onSelectConfigure} className="w-full">
        Connect Gateway
      </SecondaryButton>
    </div>
  );
}
