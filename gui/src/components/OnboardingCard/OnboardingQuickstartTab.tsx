import { Button } from "..";

function OnboardingQuickstartTab() {
  return (
    <div className="flex justify-center items-center w-full h-full">
      <div className="flex flex-col items-center justify-center w-1/2">
        {" "}
        <h1 className="text-2xl font-bold text-center">Welcome to Continue</h1>
        <p className="leading-relaxed text-center">
          Let's find the setup that works best for you. You can always update
          your configuration after onboarding by clicking the gear icon in the
          bottom-right corner of Continue.
        </p>
        <div className="mt-4 w-full">
          <Button className="w-full">Try using our API keys</Button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingQuickstartTab;
