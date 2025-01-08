import {
  DocumentIcon,
  PlusIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { useContext } from "react";
import { lightGray } from "../..";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch } from "../../../redux/hooks";
import { setProfileId } from "../../../redux/thunks/setProfileId";
import { getFontSize, getMetaKeyLabel } from "../../../util";
import { Divider, Option, OptionDiv } from "./shared";

interface AssistantSelectProps {}

export function AssistantSelect(props: AssistantSelectProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const { profiles, selectedProfile } = useAuth();

  const dispatch = useAppDispatch();

  function onNewAssistant() {
    ideMessenger.post("openUrl", "https://app.continue.dev/new");
  }

  return (
    <div className="border-lightgray flex min-w-0 flex-col border-0 border-r-[0.5px] border-solid pt-0">
      {profiles.map((option, idx) => (
        <Option
          idx={idx}
          disabled={false}
          showConfigure={true}
          selected={option.id === selectedProfile?.id}
          onConfigure={(e) => {
            e.stopPropagation();
            e.preventDefault();

            ideMessenger.post("config/openProfile", {
              profileId: option.id,
            });
          }}
          onClick={() => dispatch(setProfileId(option.id))}
        >
          <div className="flex flex-grow items-center">
            {option.id === "local" ? (
              <DocumentIcon className="mr-2 h-4 w-4 flex-shrink-0" />
            ) : (
              <SparklesIcon
                className="mr-2 h-4 w-4 flex-shrink-0"
                color={option.id === selectedProfile?.id ? "yellow" : undefined}
              />
            )}
            <span className="lines lines-1 relative flex h-5 items-center justify-between gap-3 overflow-hidden text-ellipsis pr-2 text-xs sm:max-w-32">
              {option.title}
            </span>
          </div>
        </Option>
      ))}

      <div className="mt-auto w-full">
        <OptionDiv key={profiles.length} onClick={onNewAssistant}>
          <div className="flex items-center py-0.5">
            <PlusIcon className="mr-2 h-4 w-4" />
            New Assistant
          </div>
        </OptionDiv>

        <Divider className="!my-0" />

        <span
          className="block px-3 py-2"
          style={{ color: lightGray, fontSize: getFontSize() - 4 }}
        >
          <code>{getMetaKeyLabel()}'</code> toggle assistant
        </span>
      </div>
    </div>
  );
}
