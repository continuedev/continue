import { Cog8ToothIcon } from "@heroicons/react/24/outline";
import { DISCORD_LINK, GITHUB_LINK } from "core/util/constants";
import { useContext } from "react";
import { Button, SecondaryButton } from "../../components";
import { DiscordIcon } from "../../components/svg/DiscordIcon";
import { GithubIcon } from "../../components/svg/GithubIcon";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { selectSelectedProfile } from "../../redux/";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectUseHub } from "../../redux/selectors";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { isLocalProfile } from "../../util";
import { providers } from "../AddNewModel/configs/providers";

interface StreamErrorProps {
  error: unknown;
}
const StreamErrorDialog = ({ error }: StreamErrorProps) => {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const selectedModel = useAppSelector(selectSelectedChatModel);
  const hubEnabled = useAppSelector(selectUseHub);
  const selectedProfile = useAppSelector(selectSelectedProfile);
  const { session, refreshProfiles } = useAuth();

  const handleRefreshProfiles = () => {
    refreshProfiles();
    dispatch(setShowDialog(false));
    dispatch(setDialogMessage(undefined));
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
    <Button
      className="cursor-pointer hover:underline"
      onClick={() => {
        ideMessenger.post("openUrl", apiKeyUrl!);
      }}
    >
      Check keys/usage
    </Button>
  ) : null;

  const configButton = (
    <SecondaryButton
      className="flex flex-row items-center gap-1.5 hover:underline hover:opacity-70"
      onClick={() => {
        ideMessenger.post("config/openProfile", {
          profileId: undefined,
        });
      }}
    >
      <div>
        <Cog8ToothIcon className="h-4 w-4" />
      </div>
      <span>Open Assistant configuration</span>
    </SecondaryButton>
  );

  let errorContent: React.ReactNode = <></>;

  // Display components for specific errors
  if (statusCode === 429) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>
          {`This might mean your ${modelTitle} usage has been rate limited
                by ${providerName}.`}
        </span>
        <div className="flex flex-row flex-wrap gap-2">
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
        {hubEnabled &&
          session &&
          selectedProfile &&
          !isLocalProfile(selectedProfile) && (
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

  return (
    <div className={`flex flex-col gap-1 px-3 pb-2 pt-2`}>
      <p className="m-0 p-0 text-lg text-red-500">{`${statusCode ? statusCode + " " : ""}Error`}</p>

      {message ? (
        <div className="mt-2 flex flex-col gap-0 rounded-sm border border-solid">
          <code className="max-h-20 overflow-y-auto px-1 py-1">{message}</code>
          <div
            className="flex cursor-pointer flex-row justify-end px-1 py-1 hover:underline"
            onClick={() => {
              ideMessenger.post("toggleDevTools", undefined);
            }}
          >
            <span className="px-2">View Logs</span>
          </div>
        </div>
      ) : null}
      <div className="mt-3">{errorContent}</div>

      <div className="mt-2 flex flex-col gap-1.5">
        <span>Report this error:</span>
        <div className="flex flex-row flex-wrap items-center gap-2">
          <SecondaryButton
            className="flex flex-row items-center gap-2 hover:opacity-70"
            onClick={() => {
              ideMessenger.post("openUrl", GITHUB_LINK);
            }}
          >
            <GithubIcon className="h-5 w-5" />
            <span className="xs:flex hidden">Github</span>
          </SecondaryButton>
          <SecondaryButton
            className="flex flex-row items-center gap-2 hover:opacity-70"
            onClick={() => {
              ideMessenger.post("openUrl", DISCORD_LINK);
            }}
          >
            <DiscordIcon className="h-5 w-5" />
            <span className="xs:flex hidden">Discord</span>
          </SecondaryButton>
        </div>
        <div className="flex flex-row justify-end">
          <Button
            onClick={() => {
              dispatch(setDialogMessage(undefined));
              dispatch(setShowDialog(false));
            }}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StreamErrorDialog;
