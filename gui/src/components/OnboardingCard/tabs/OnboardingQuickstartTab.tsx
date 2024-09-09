import styled from "styled-components";
import { Button, lightGray } from "../..";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { OnboardingTab } from "./types";

const ButtonSubtext = styled.p`
  margin-top: 0;
  text-align: center;
  color: ${lightGray};
`;

function OnboardingQuickstartTab({ onComplete }: OnboardingTab) {
  return (
    <div className="flex justify-center items-center">
      <div className="flex flex-col items-center justify-center w-3/4 text-center">
        <h1 className="text-2xl mb-0">Welcome to Continue</h1>
        <p className="text-base">
          Let's find the setup that works best for you. You can always update
          your configuration after onboarding by clicking the{" "}
          <Cog6ToothIcon className="inline-block h-4 w-4 align-middle px-0.5" />{" "}
          icon in the bottom-right corner.
        </p>

        <p className="text-base">
          After set up, we'll walk you through how to use Continue in a sample
          file.
        </p>

        <div className="mt-4 w-full">
          <Button className="w-full" onClick={onComplete}>
            Get started using our API keys
          </Button>
          <ButtonSubtext>You'll receive 50 requests for free</ButtonSubtext>
        </div>
      </div>
    </div>
  );
}

export default OnboardingQuickstartTab;
