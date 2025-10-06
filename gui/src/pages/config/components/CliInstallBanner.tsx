import { CommandLineIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useContext, useEffect, useState } from "react";
import Alert from "../../../components/gui/Alert";
import { Button } from "../../../components/ui/Button";
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
  // if (cliInstalled === null || cliInstalled === true || dismissed) {
  //   return null;
  // }

  return (
    <div className="border-t-vsc-input-border bg-vsc-background sticky bottom-0 border-t px-4 pb-4 pt-4">
      <Alert type="info" className="relative">
        <div className="flex items-start gap-3">
          <CommandLineIcon className="text-info mt-0.5 h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-medium">Try the Continue CLI</div>
            <div className="text-description mt-1 text-sm">
              Use{" "}
              <code className="bg-vsc-editor-background rounded px-1.5 py-0.5">
                cn
              </code>{" "}
              in your terminal for command-line coding assistance with
              interactive and headless modes.
            </div>
            <div className="mt-2 flex items-center gap-3">
              <code className="bg-vsc-editor-background rounded px-2 py-1 text-xs">
                npm i -g @continuedev/cli
              </code>
              <button
                onClick={() =>
                  ideMessenger.post(
                    "openUrl",
                    "https://docs.continue.dev/guides/cli",
                  )
                }
                className="text-info hover:text-info/80 text-sm underline"
              >
                Learn more →
              </button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-description hover:text-foreground -mr-2 -mt-1 h-6 w-6 p-0"
            onClick={() => setDismissed(true)}
          >
            <XMarkIcon className="h-4 w-4" />
          </Button>
        </div>
      </Alert>
    </div>
  );
}
