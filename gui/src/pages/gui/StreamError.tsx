import { Cog8ToothIcon, ListBulletIcon } from "@heroicons/react/24/outline";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { useContext } from "react";
import { GithubIcon } from "../../components/svg/GithubIcon";
import { DiscordIcon } from "../../components/svg/DiscordIcon";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { DISCORD_LINK, GITHUB_LINK } from "core/util/constants";
import { selectDefaultModel } from "../../redux/slices/configSlice";
import { providers } from "../AddNewModel/configs/providers";
import { Button, SecondaryButton } from "../../components";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";

interface StreamErrorProps {
  error: unknown;
}
const StreamErrorDialog = ({ error }: StreamErrorProps) => {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const selectedModel = useAppSelector(selectDefaultModel);

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
  if (error && (error instanceof Error || typeof error === "object")) {
    if (error["message"]) {
      message = error["message"];
      const status = message?.split(" ")[0];
      if (status) {
        const code = Number(status);
        if (!Number.isNaN(statusCode)) {
          statusCode = code;
        }
      }
    }
  }
  let errorContent: React.ReactNode = (
    <span>Error while streaming chat response.</span>
  );

  if (statusCode === 429) {
    errorContent = (
      <div className="flex flex-col gap-2">
        <span>
          {`This likely means your ${modelTitle} usage has been rate limited
                by ${providerName}.`}
        </span>
        {apiKeyUrl ? (
          <Button
            className="cursor-pointer hover:underline"
            onClick={() => {
              ideMessenger.post("openUrl", apiKeyUrl!);
            }}
          >
            Check keys/usage
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 px-3 pb-2 pt-2`}>
      <p className="m-0 p-0 text-lg text-red-500">{`${statusCode ? statusCode + " " : ""}Error`}</p>
      <div className="">{errorContent}</div>

      {message ? (
        <div className="mt-2 flex flex-col gap-0 rounded-sm border border-solid">
          <code className="max-h-20 overflow-y-scroll px-1 py-1">
            {message}
          </code>
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
      <div className="mt-2 flex flex-col gap-1.5">
        <div>
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
            <span>Open config</span>
          </SecondaryButton>
        </div>
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
