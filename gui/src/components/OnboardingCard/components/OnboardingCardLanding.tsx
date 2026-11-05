import { SecondaryButton } from "../..";
import ContinuedLogo from "../../svg/ContinuedLogo";

export function OnboardingCardLanding({
  onSelectConfigure,
  isDialog,
}: {
  onSelectConfigure: () => void;
  isDialog?: boolean;
}) {
  return (
    <div className="max-full flex w-full flex-col items-center justify-center px-4 text-center xs:px-0">
      <div className="hidden xs:flex">
        <ContinuedLogo height={75} />
      </div>

      <p className="mt-0 mb-5 w-full text-sm">
        Get started with AI-powered coding by configuring your models
      </p>

      <SecondaryButton onClick={onSelectConfigure} className="w-full">
        Configure your models
      </SecondaryButton>
    </div>
  );
}
