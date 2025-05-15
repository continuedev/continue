import { DISCORD_LINK, GITHUB_LINK } from "core/util/constants";
import { useContext } from "react";
import { SecondaryButton } from "../../components";
import { DiscordIcon } from "../../components/svg/DiscordIcon";
import { GithubIcon } from "../../components/svg/GithubIcon";
import { IdeMessengerContext } from "../../context/IdeMessenger";

export function ModelsAddOnLimitDialog() {
  const ideMessenger = useContext(IdeMessengerContext);

  return (
    <div className={`flex flex-col gap-1 px-3 pb-2 pt-3`}>
      <p className="m-0 p-0 text-lg">Models Add-On Limit Reached</p>

      <div className="mt-2 flex flex-col gap-1.5">
        <span>
          You have reached the monthly limit for chat requests with the Models
          Add-On. This limit exists to avoid abuse, but if this happened from
          normal usage we encourage you to contact us on GitHub or Discord
        </span>
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
      </div>
    </div>
  );
}
