"use client";

import { Button } from "@/components/ui/button";
import { ArrowLongRightIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { IdeMessengerContext } from "@/context/IdeMessenger";

export default function ImportExtensions({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: () => void;
}) {
  const ideMessenger = useContext(IdeMessengerContext);

  return (
    <div className="flex w-full overflow-hidden bg-background text-foreground">
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
            Import Extensions and Settings
          </h2>

          <p className="text-muted-foreground text-sm md:text-base mb-12">
            Import your VS Code extensions and settings to PearAI
          </p>

          <div className="flex flex-col items-center gap-4">
            <Button
              className="w-[200px] text-button-foreground bg-button hover:bg-button-hover p-4 md:p-5 lg:p-6 text-sm md:text-base cursor-pointer"
              onClick={() => {
                ideMessenger.post("importUserSettingsFromVSCode", undefined);
                onNext();
              }}
            >
              Import Extensions
            </Button>

            <div
              onClick={onNext}
              className="text-sm text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] underline cursor-pointer transition-colors"
            >
              Skip importing extensions
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
