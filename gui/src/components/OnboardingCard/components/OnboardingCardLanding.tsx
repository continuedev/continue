import { SecondaryButton } from "../..";
import ContinueLogo from "../../svg/ContinueLogo";

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
        <ContinueLogo height={75} />
      </div>

      <p className="mb-5 mt-0 w-full text-sm">
        Get started with AI-powered coding by configuring your models
      </p>

      <SecondaryButton onClick={onSelectConfigure} className="w-full">
        Configure your models
      </SecondaryButton>
    </div>
  );
}
