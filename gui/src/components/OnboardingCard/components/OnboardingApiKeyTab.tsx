import Alert from "../../gui/Alert";

interface OnboardingApiKeyTabProps {
  isDialog?: boolean;
}

export function OnboardingApiKeyTab({ isDialog }: OnboardingApiKeyTabProps) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Alert>Configure Continue to a variety of model providers</Alert>
    </div>
  );
}
