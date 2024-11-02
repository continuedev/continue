"use client";

import { Button } from "@/components/ui/button";
import { ArrowLongRightIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { IdeMessengerContext } from "@/context/IdeMessenger";
import { useWebviewListener } from "@/hooks/useWebviewListener";

export default function SignIn({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const ideMessenger = useContext(IdeMessengerContext);

  useWebviewListener("pearAISignedIn", async () => {
    onNext();
    return Promise.resolve();
  });

  return (
    <div className="step-content flex w-full overflow-hidden bg-background text-foreground">
      <div className="w-full flex flex-col h-screen">
        <div
          onClick={onBack}
          className="absolute top-4 left-4 md:top-6 md:left-6 lg:top-8 lg:left-8 flex items-center gap-2 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] cursor-pointer transition-colors group"
        >
          <ArrowLongRightIcon className="w-4 h-4 rotate-180" />
          <span className="text-sm">Back</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 lg:p-10">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-6">
            Sign in to your account
          </h2>

          <p className="text-muted-foreground text-base md:text-md max-w-[500px] text-center mb-16">
            Sign up to start using PearAI and supercharge your development
            workflow
          </p>

          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 mb-12">
            <Button
              className="w-[250px] md:w-[280px] text-button-foreground bg-button hover:bg-button-hover p-5 md:p-6 text-base md:text-lg cursor-pointer"
              onClick={() => ideMessenger.post("pearaiLogin", undefined)}
            >
              Sign in
            </Button>

            <Button className="w-[250px] md:w-[280px] bg-input  border border-input p-5 md:p-6 text-base md:text-lg cursor-pointer">
              <a
                href="https://trypear.ai/signup"
                target="_blank"
                className="text-foreground hover:text-button-foreground no-underline"
              >
                Sign up
              </a>
            </Button>
          </div>

          <div
            onClick={() => {
              ideMessenger.post("markNewOnboardingComplete", undefined);
              onNext();
            }}
            className="text-sm underline cursor-pointer text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] transition-colors"
          >
            Skip Sign In
          </div>
        </div>
      </div>
    </div>
  );
}
