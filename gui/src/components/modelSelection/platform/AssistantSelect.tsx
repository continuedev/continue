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
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";
import { setProfileId } from "../../../redux/thunks/setProfileId";
import { getFontSize, getMetaKeyLabel } from "../../../util";
import AboutAssistantDialog from "../../dialogs/AboutAssistantDialog";
import { Divider, Option, OptionDiv } from "./shared";

interface AssistantSelectProps {
  onClose: () => void;
}

export function AssistantSelect(props: AssistantSelectProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const { profiles, selectedProfile } = useAuth();

  const dispatch = useAppDispatch();

  function onNewAssistant() {
    ideMessenger.post("openUrl", "https://app-test.continue.dev/new");
  }

  return (
    <div className="border-lightgray flex min-w-0 flex-col overflow-x-hidden border-0 border-r-[0.5px] border-solid pt-0">
      <div className={`max-h-[300px]`}>
        {profiles.map((option, idx) => (
          <Option
            key={idx}
            idx={idx}
            disabled={!!option.errors?.length}
            showConfigure={true}
            selected={option.id === selectedProfile?.id}
            onLink={
              option.id !== "local"
                ? (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    ideMessenger.post("config/openProfile", {
                      profileId: option.id,
                    });
                  }
                : undefined
            }
            onConfigure={(e) => {
              e.stopPropagation();
              e.preventDefault();

              if (option.id === "local") {
                ideMessenger.post("config/openProfile", {
                  profileId: option.id,
                });
              } else {
                props.onClose();
                dispatch(setDialogMessage(<AboutAssistantDialog />));
                dispatch(setShowDialog(true));
              }
            }}
            errors={option.errors}
            onClickError={() => {
              ideMessenger.post("config/openProfile", {
                profileId: option.id,
              });
            }}
            onClick={() => dispatch(setProfileId(option.id))}
          >
            <div className="flex min-w-0 items-center">
              {option.id === "local" ? (
                <DocumentIcon className="mr-2 h-4 w-4 flex-shrink-0" />
              ) : (
                <SparklesIcon
                  className="mr-2 h-4 w-4 flex-shrink-0"
                  color={
                    option.id === selectedProfile?.id ? "yellow" : undefined
                  }
                />
              )}
              <span className="flex-1 truncate text-xs">{option.title}</span>
            </div>
          </Option>
        ))}
      </div>

      <div className="mt-auto w-full">
        <OptionDiv key={profiles.length} onClick={onNewAssistant}>
          <div className="flex items-center py-0.5">
            <PlusIcon className="mr-2 h-4 w-4 flex-shrink-0" />
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
