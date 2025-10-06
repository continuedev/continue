import { CommandLineIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useContext, useEffect, useState } from "react";
import { SecondaryButton } from "../../../components";
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
    // return null;
  }

  return (
    <div className="border-t-vsc-input-border bg-vsc-background sticky bottom-0 border-t px-4 pb-4 pt-4">
      <Card className="relative">
        <button
          className="hover:bg-vsc-background hover:text-foreground absolute right-2 top-2 rounded p-1 text-gray-500"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-4 pr-8">
          <CommandLineIcon className="mt-1 h-6 w-6 flex-shrink-0 text-gray-400" />
          <div className="flex flex-1 flex-col gap-2">
            <div>
              <div className="text-foreground font-medium">
                Try the Continue CLI
              </div>
              <div className="text-description mt-1 text-sm">
                Use{" "}
                <code className="bg-vsc-background rounded px-1.5 py-0.5">
                  cn
                </code>{" "}
                in your terminal for command-line coding assistance with
                interactive and headless modes.
              </div>
            </div>
            <div className="flex items-center gap-3">
              <code className="bg-vsc-background text-foreground rounded px-2 py-1 text-xs">
                npm i -g @continuedev/cli
              </code>
              <SecondaryButton
                onClick={() =>
                  ideMessenger.post(
                    "openUrl",
                    "https://docs.continue.dev/guides/cli",
                  )
                }
                style={{ margin: 0 }}
              >
                Learn more
              </SecondaryButton>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
