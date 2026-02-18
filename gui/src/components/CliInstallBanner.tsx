import { CommandLineIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useContext, useEffect, useRef, useState } from "react";
import { CloseButton } from ".";
import { IdeMessengerContext } from "../context/IdeMessenger";
import useCopy from "../hooks/useCopy";
import { getPlatform } from "../util";
import { getLocalStorage, setLocalStorage } from "../util/localStorage";
import { CopyButton } from "./StyledMarkdownPreview/StepContainerPreToolbar/CopyButton";
import { RunInTerminalButton } from "./StyledMarkdownPreview/StepContainerPreToolbar/RunInTerminalButton";
import { Card } from "./ui";

interface CliInstallBannerProps {
  /** Number of sessions user has had - banner shows only if >= sessionThreshold */
  sessionCount?: number;
  /** Minimum sessions before showing banner (default: always show) */
  sessionThreshold?: number;
  /** If true, dismissal is permanent via localStorage (default: session only) */
  permanentDismissal?: boolean;
}

export function CliInstallBanner({
  sessionCount,
  sessionThreshold,
  permanentDismissal = false,
}: CliInstallBannerProps = {}) {
  const ideMessenger = useContext(IdeMessengerContext);
  const [cliInstalled, setCliInstalled] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const commandTextRef = useRef<HTMLSpanElement>(null);
  const { copyText } = useCopy("npm i -g @continuedev/cli");
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);

  const handleCommandClick = () => {
    // Select the text
    if (commandTextRef.current) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(commandTextRef.current);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    // Copy to clipboard
    copyText();

    // Show "Copied!" message for 3 seconds
    setShowCopiedMessage(true);
    setTimeout(() => setShowCopiedMessage(false), 3000);
  };

  useEffect(() => {
    // Check if user has permanently dismissed the banner
    if (permanentDismissal) {
      const hasDismissed = getLocalStorage("hasDismissedCliInstallBanner");
      if (hasDismissed) {
        setDismissed(true);
        return;
      }
    }

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

    void checkCliInstallation();
  }, [ideMessenger, permanentDismissal]);

  const handleDismiss = () => {
    setDismissed(true);
    if (permanentDismissal) {
      setLocalStorage("hasDismissedCliInstallBanner", true);
    }
  };

  // Don't show if:
  // - Still loading CLI status
  // - CLI is already installed
  // - User has dismissed it
  // - Session threshold not met (if threshold is set)
  if (
    cliInstalled === null ||
    cliInstalled === true ||
    dismissed ||
    (sessionThreshold !== undefined &&
      (sessionCount === undefined || sessionCount < sessionThreshold))
  ) {
    return null;
  }

  return (
    <div className="border-t-vsc-input-border bg-vsc-background sticky bottom-0 border-t px-4 pb-4 pt-4">
      <Card className="relative">
        <CloseButton onClick={handleDismiss}>
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
            <div className="rounded-default outline-command-border flex items-center self-stretch outline outline-1">
              <div className="bg-editor rounded-l-default relative flex-1 px-3 py-3">
                <span
                  ref={commandTextRef}
                  className="text-foreground cursor-pointer text-xs"
                  style={{ fontFamily: "var(--vscode-editor-font-family)" }}
                  onClick={handleCommandClick}
                >
                  npm i -g @continuedev/cli
                </span>
                {showCopiedMessage && (
                  <span className="bg-editor rounded-l-default absolute inset-0 flex items-center justify-center px-2 text-xs font-medium">
                    Copied!
                  </span>
                )}
              </div>
              <div className="bg-background rounded-r-default flex items-center gap-2 px-3 py-3">
                <CopyButton
                  text={`npm i -g @continuedev/cli && cn "Explore this repo and provide a concise summary of it's contents"`}
                />
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
