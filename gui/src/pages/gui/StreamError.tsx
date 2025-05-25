import {
  ArrowTopRightOnSquareIcon,
  ClipboardIcon,
  Cog6ToothIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";
import { DISCORD_LINK, GITHUB_LINK } from "core/util/constants";
import { useContext, useMemo } from "react";
import { GhostButton, SecondaryButton } from "../../components";
import { DiscordIcon } from "../../components/svg/DiscordIcon";
import { GithubIcon } from "../../components/svg/GithubIcon";
import ToggleDiv from "../../components/ToggleDiv";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { selectSelectedProfile } from "../../redux/";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { isLocalProfile } from "../../util";
import { providers } from "../AddNewModel/configs/providers";
import { ModelsAddOnLimitDialog } from "./ModelsAddOnLimitDialog";

interface StreamErrorProps {
  error: unknown;
}

function parseErrorMessage(fullErrMsg: string): string {
  if (!fullErrMsg.includes("\n\n")) {
    return fullErrMsg;
  }

  const msg = fullErrMsg.split("\n\n").slice(1).join("\n\n");
  try {
    const parsed = JSON.parse(msg);
    return JSON.stringify(parsed.error ?? parsed.message ?? msg);
  } catch (e) {
    return msg;
  }
}

const StreamErrorDialog = ({ error }: StreamErrorProps) => {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const selectedModel = useAppSelector(selectSelectedChatModel);
  const selectedProfile = useAppSelector(selectSelectedProfile);
  const { session, refreshProfiles } = useAuth();

  const parsedError = useMemo<string>(
    () => parseErrorMessage((error as any)?.message || ""),
    [error],
  );

  const handleRefreshProfiles = () => {
    void refreshProfiles();
    dispatch(setShowDialog(false));
    dispatch(setDialogMessage(undefined));
  };

  const copyErrorToClipboard = () => {
    void navigator.clipboard.writeText(parsedError);
  };

  // Collect model information to display useful error info
  let modelTitle = "Chat model";
  let providerName = "the model provider";
  let apiKeyUrl: string | undefined = undefined;

  if (selectedModel) {
    modelTitle = selectedModel.title;
    providerName = selectedModel.provider;

    // If there's a matching provider from add model form provider info
    // We can get more info
    const foundProvider = Object.values(providers).find(
      (p) => p?.provider === selectedModel.provider,
    );
    if (foundProvider) {
      providerName = foundProvider.title;
      if (foundProvider.apiKeyUrl) {
        apiKeyUrl = foundProvider.apiKeyUrl;
      }
    }
  }

  let message: undefined | string = undefined;
  let statusCode: undefined | number = undefined;

  // Attempt to get error message and status code from error
  if (
    error &&
    (error instanceof Error || typeof error === "object") &&
    "message" in error &&
    typeof error["message"] === "string"
  ) {
    message = error["message"];
    const parts = message?.split(" ") ?? [];
    if (parts.length > 1) {
      const status = parts[0] === "HTTP" ? parts[1] : parts[0];
      if (status) {
        const code = Number(status);
        if (!Number.isNaN(code)) {
          statusCode = code;
        }
      }
    }
  }

  const checkKeysButton = apiKeyUrl ? (
    <GhostButton
      className="flex items-center"
      onClick={() => {
        ideMessenger.post("openUrl", apiKeyUrl!);
      }}
    >
      <KeyIcon className="mr-1.5 h-3.5 w-3.5" />
      <span>View key</span>
    </GhostButton>
  ) : null;

  const configButton = (
    <GhostButton
      className="flex items-center"
      onClick={() => {
        ideMessenger.post("config/openProfile", {
          profileId: undefined,
        });
      }}
    >
      <Cog6ToothIcon className="mr-1.5 h-3.5 w-3.5" />
      <span>View config</span>
    </GhostButton>
  );

  if (
    parsedError === "You have exceeded the chat limit for the Models Add-On."
  ) {
    return <ModelsAddOnLimitDialog />;
  }

  let errorContent = (
    <div className="mb-3 mt-1">
      <div className="m-0 p-0">
        <p className="m-0 mb-2 p-0">
          There was an error handling the response from{" "}
          {selectedModel?.title || "the model"}.
        </p>
        <p className="m-0 p-0">
          Please try to submit your message again, and if the error persists,
          let us know by reporting the issue using the buttons below.
        </p>
      </div>
    </div>
  );

  // Display components for specific errors
  if (statusCode === 429) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>
          {`This might mean your ${modelTitle} usage has been rate limited
                by ${providerName}.`}
        </span>
        <div className="flex flex-row flex-wrap justify-start gap-3 py-4">
          {checkKeysButton}
          {configButton}
        </div>
      </div>
    );
  }

  if (statusCode === 404) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>Likely causes:</span>
        <ul className="m-0">
          <li>
            <span>Invalid</span>
            <code>apiBase</code>
            {selectedModel && (
              <>
                <span>{`: `}</span>
                <code>{selectedModel.apiBase}</code>
              </>
            )}
          </li>
          <li>
            <span>Model/deployment not found</span>
            {selectedModel && (
              <>
                <span>{` for: `}</span>
                <code>{selectedModel.model}</code>
              </>
            )}
          </li>
        </ul>
        <div>{configButton}</div>
      </div>
    );
  }

  if (statusCode === 401) {
    errorContent = (
      <div className="flex flex-col gap-2">
        {session && selectedProfile && !isLocalProfile(selectedProfile) && (
          <div className="flex flex-col gap-1">
            <span>{`If your hub secret values may have changed, refresh your assistants`}</span>
            <SecondaryButton onClick={handleRefreshProfiles}>
              Refresh assistant secrets
            </SecondaryButton>
          </div>
        )}
        <span>{`It's possible that your API key is invalid.`}</span>
        <div className="flex flex-row flex-wrap gap-2">
          {checkKeysButton}
          {configButton}
        </div>
      </div>
    );
  }

  if (statusCode === 403) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>{`Likely cause: not authorized to access the model deployment.`}</span>
        <div className="flex flex-row flex-wrap gap-2">
          {checkKeysButton}
          {configButton}
        </div>
      </div>
    );
  }

  if (
    message &&
    (message.toLowerCase().includes("overloaded") ||
      message.toLowerCase().includes("malformed"))
  ) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>{`Most likely, the provider's server(s) are overloaded and streaming was interrupted. Try again later`}</span>
        {selectedModel ? (
          <span>
            {`Provider: `}
            <code>{selectedModel.provider}</code>
          </span>
        ) : null}
        {/* TODO: status page links for providers? */}
      </div>
    );
  }

  console.log({ message });

  return (
    <div className="flex flex-col gap-4 px-3 pb-3 pt-3">
      {/* Concise error title */}
      <h3 className="text-error m-0 p-0 text-lg font-medium">
        Error handling model response
      </h3>

      {errorContent}

      {/* Expandable technical details using ToggleDiv */}
      {message && (
        <div className="mb-2">
          <ToggleDiv title="View error output" testId="error-output-toggle">
            <div className="flex flex-col gap-0 rounded-sm">
              <code className="text-editor-foreground block max-h-48 overflow-y-auto p-3 font-mono text-xs">
                {parsedError}
              </code>

              <div className="flex flex-row items-center justify-end gap-2 p-2">
                <GhostButton
                  onClick={copyErrorToClipboard}
                  className="flex items-center"
                >
                  <ClipboardIcon className="mr-1.5 h-3.5 w-3.5" />
                  <span>Copy output</span>
                </GhostButton>

                <GhostButton
                  onClick={() => {
                    ideMessenger.post("toggleDevTools", undefined);
                  }}
                  className="flex items-center"
                >
                  <ArrowTopRightOnSquareIcon className="mr-1.5 h-4 w-4" />
                  <span className="text-xs">View Logs</span>
                </GhostButton>
              </div>
            </div>
          </ToggleDiv>
        </div>
      )}

      <div>
        <span className="text-base font-medium">Report this error</span>
        <div className="mt-2 flex flex-row flex-wrap items-center gap-2">
          <GhostButton
            className="flex flex-row items-center gap-2 rounded px-3 py-1.5"
            onClick={() => {
              ideMessenger.post("openUrl", GITHUB_LINK);
            }}
          >
            <GithubIcon className="h-5 w-5" />
            <span className="xs:flex hidden">Github</span>
          </GhostButton>
          <GhostButton
            className="flex flex-row items-center gap-2 rounded px-3 py-1.5"
            onClick={() => {
              ideMessenger.post("openUrl", DISCORD_LINK);
            }}
          >
            <DiscordIcon className="h-5 w-5" />
            <span className="xs:flex hidden">Discord</span>
          </GhostButton>
        </div>
      </div>
    </div>
  );
};

export default StreamErrorDialog;
