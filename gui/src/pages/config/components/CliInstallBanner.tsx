import { CommandLineIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useContext, useEffect, useState } from "react";
import { CloseButton, SecondaryButton } from "../../../components";
import { CopyButton } from "../../../components/StyledMarkdownPreview/StepContainerPreToolbar/CopyButton";
import { RunInTerminalButton } from "../../../components/StyledMarkdownPreview/StepContainerPreToolbar/RunInTerminalButton";
import { Card } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { getPlatform } from "../../../util";

export function CliInstallBanner() {
  const ideMessenger = useContext(IdeMessengerContext);
  const [cliInstalled, setCliInstalled] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkCliInstallation = async () => {
      try {
        const platform = getPlatform();
        // Use 'which' on mac/linux, 'where' on windows
        const command = platform === "windows" ? "where cn" : "which cn";

        const [stdout, stderr] = await ideMessenger.ide.subprocess(command);

        // If stdout has content (path to cn), it's installed
        // If empty or stderr has "not found", it's not installed
        const isInstalled =
          stdout.trim().length > 0 && !stderr.includes("not found");
        setCliInstalled(isInstalled);
      } catch (error) {
        // If subprocess throws an error, assume CLI is not installed
        setCliInstalled(false);
      }
    };

    checkCliInstallation();
  }, [ideMessenger]);

  // Don't show if still loading, already installed, or dismissed
  if (cliInstalled === null || cliInstalled === true || dismissed) {
    return null;
  }

  return (
    <div className="border-t-vsc-input-border bg-vsc-background sticky bottom-0 border-t px-4 pb-4 pt-4">
      <Card className="relative">
        <CloseButton onClick={() => setDismissed(true)}>
          <XMarkIcon className="h-5 w-5 hover:brightness-125" />
        </CloseButton>
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-foreground flex items-center gap-2 font-medium">
              <CommandLineIcon className="h-5 w-5 flex-shrink-0 text-gray-400" />
              Try out the Continue CLI
            </div>
            <div className="text-description mt-1 text-sm">
              Use{" "}
              <code className="bg-vsc-background rounded px-1.5 py-0.5">
                cn
              </code>{" "}
              in your terminal interactively and then deploy Continuous AI
              workflows.{" "}
              <span
                onClick={() =>
                  ideMessenger.post(
                    "openUrl",
                    "https://docs.continue.dev/guides/cli",
                  )
                }
                className="cursor-pointer underline hover:brightness-125"
              >
                Learn more.
              </span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 self-stretch">
            <div className="bg-vsc-background flex items-center gap-2 self-stretch rounded border border-gray-600 px-3 py-2">
              <code className="text-foreground flex-1 text-xs">
                npm i -g @continuedev/cli
              </code>
              <div className="flex items-center gap-2">
                <CopyButton text="npm i -g @continuedev/cli" />
                <RunInTerminalButton
                  command={`npm i -g @continuedev/cli && cn "Explore this repo and provide a concise summary of it's contents"`}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
