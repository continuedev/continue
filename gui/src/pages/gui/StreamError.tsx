import { Cog8ToothIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setStreamError } from "../../redux/slices/sessionSlice";
import { useContext, useEffect, useMemo } from "react";
import { GithubIcon } from "../../components/svg/GithubIcon";
import { DiscordIcon } from "../../components/svg/DiscordIcon";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { DISCORD_LINK, GITHUB_LINK } from "core/util/constants";
import {
  selectDefaultModel,
  setDefaultModel,
} from "../../redux/slices/configSlice";
import { ToolTip } from "../../components/gui/Tooltip";
import { providers } from "../AddNewModel/configs/providers";
import { Button, SecondaryButton } from "../../components";

interface StreamErrorProps {
  slideDirection: "up" | "down";
}
const StreamError = ({ slideDirection }: StreamErrorProps) => {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const streamError = useAppSelector((state) => state.session.streamError);
  const selectedModel = useAppSelector(selectDefaultModel);

  useEffect(() => {
    dispatch(setStreamError(undefined));
  }, [selectedModel]);

  const errorContent = useMemo(() => {
    // TODO use updated LLM-INFO strategy to get this info

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
    return streamError
      ? ({
          429: (
            <div className="flex flex-col gap-2">
              <span>
                {`${modelTitle} has been rate limited
                by ${providerName}.`}
              </span>
              {apiKeyUrl ? (
                <Button
                  className="cursor-pointer hover:underline"
                  onClick={() => {
                    ideMessenger.post("openUrl", apiKeyUrl!);
                  }}
                >
                  Check your keys
                </Button>
              ) : null}
            </div>
          ),
        }[streamError.statusCode] ?? (
          <span>There was an error completing"</span>
        ))
      : null;
  }, [streamError, selectedModel]);

  return (
    <div className="flex flex-col overflow-hidden">
      <div
        className={`flex flex-col gap-1 overflow-hidden px-3 pb-2 pt-1 transition-all ${!!streamError ? "" : slideDirection === "up" ? "translate-y-full" : ""}`}
        style={
          {
            // height: streamError ? 100 : 0,
          }
        }
      >
        <div className="relative flex flex-row justify-between">
          <div className="text-lg text-red-500">Chat Error</div>
          <div
            className="cursor-pointer hover:opacity-80"
            onClick={() => {
              dispatch(setStreamError(undefined));
            }}
          >
            <XMarkIcon className="h-5 w-5 text-stone-500" />
          </div>
        </div>
        <div>{errorContent}</div>
        <div className="flex flex-row flex-wrap items-center justify-end">
          <div className="flex flex-row items-center gap-1.5">
            <span
              className="flex cursor-pointer flex-row items-center gap-1.5 hover:underline"
              onClick={() => {
                ideMessenger.post("config/openProfile", {
                  profileId: undefined,
                });
              }}
            >
              <div className="hidden h-5 w-5 sm:block">
                <Cog8ToothIcon />
              </div>
              <span>Config</span>
            </span>
            <span className="font-bold">|</span>

            <div
              className="flex cursor-pointer flex-row items-center text-center hover:underline"
              onClick={() => {
                ideMessenger.post("toggleDevTools", undefined);
              }}
            >
              <span>Logs</span>
            </div>
            <span className="font-bold">|</span>
            <span className="hidden sm:flex">Report:</span>
            <div>
              <GithubIcon
                data-tooltip-id={"github-report"}
                className="h-5 w-5 cursor-pointer hover:opacity-80"
                onClick={() => {
                  ideMessenger.post("openUrl", GITHUB_LINK);
                }}
              />
              <ToolTip id={"github-report"}>Github</ToolTip>
            </div>
            <div>
              <DiscordIcon
                data-tooltip-id={"discord-report"}
                className="h-5 w-5 cursor-pointer hover:opacity-80"
                onClick={() => {
                  ideMessenger.post("openUrl", DISCORD_LINK);
                }}
              />
              <ToolTip id={"discord-report"}>Discord</ToolTip>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamError;
