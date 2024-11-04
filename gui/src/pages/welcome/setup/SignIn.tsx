"use client";

import { Button } from "@/components/ui/button";
import { ArrowLongRightIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { useContext, useEffect } from "react";
import { IdeMessengerContext } from "@/context/IdeMessenger";
import { useWebviewListener } from "@/hooks/useWebviewListener";
import { getMetaKeyLabel } from "@/util";

export default function SignIn({
  onNext,
}: {
  onNext: () => void;
}) {
  const ideMessenger = useContext(IdeMessengerContext);

  useWebviewListener("pearAISignedIn", async () => {
    onNext();
    return Promise.resolve();
  });

  const handleSignIn = () => {
    ideMessenger.post("pearaiLogin", undefined);
  };

  const handleSignUp = () => {
    ideMessenger.post("openUrl", "https://trypear.ai/signup");
  };

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
        // Regular Enter for Sign In
        handleSignIn();
      } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        // Ctrl/Cmd + Enter for Sign Up
        event.preventDefault();
        handleSignUp();
      } else if ((event.metaKey || event.ctrlKey) && event.key === 'ArrowRight') {
        // Ctrl/Cmd + ArrowRight for Skip
        event.preventDefault();
        ideMessenger.post("markNewOnboardingComplete", undefined);
        onNext();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className="step-content flex w-full overflow-hidden bg-background text-foreground">
      <div className="w-full flex flex-col h-screen">
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
              className="w-[250px] md:w-[280px] text-button-foreground bg-button hover:bg-button-hover py-5 px-2 md:py-6 text-base md:text-lg cursor-pointer relative"
              onClick={handleSignIn}
            >
              <div className="flex items-center justify-between w-full gap-2">
                <span className="text-center w-full">Sign In</span>
              </div>
            </Button>

            <Button
              className="w-[250px] md:w-[280px] bg-input text-foreground border border-input py-5 px-2 md:py-6 text-base md:text-lg cursor-pointer relative"
              onClick={handleSignUp}
            >
              <div className="flex items-center justify-between w-full gap-2">
                <span className="text-center w-full">Sign Up</span>
              </div>
            </Button>
          </div>

          <div
            onClick={() => {
              ideMessenger.post("markNewOnboardingComplete", undefined);
              onNext();
            }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span className="text-center w-full">Skip</span>
          </div>
        </div>
      </div>
    </div>
  );
}