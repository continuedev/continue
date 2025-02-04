import { PlusIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { lightGray } from "../..";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch } from "../../../redux/hooks";
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";
import { setProfileId } from "../../../redux/thunks/setProfileId";
import { getFontSize, getMetaKeyLabel, isLocalProfile } from "../../../util";
import AboutAssistantDialog from "../../dialogs/AboutAssistantDialog";
import { Divider, Option, OptionDiv } from "./shared";
import { getProfileDisplayText } from "./utils";
import AssistantIcon from "./AssistantIcon";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../../util/navigation";

interface AssistantSelectOptionsProps {
  onClose: () => void;
}

export function AssistantSelectOptions(props: AssistantSelectOptionsProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const { profiles, selectedProfile, selectedOrganization } = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  function onNewAssistant() {
    ideMessenger.post("controlPlane/openUrl", {
      path: "platform/new",
    });
  }

  function handleOptionLink(e: React.MouseEvent, profileId: string) {
    e.stopPropagation();
    e.preventDefault();
    ideMessenger.post("config/openProfile", { profileId });
  }

  function handleConfigure(e: React.MouseEvent, option: any) {
    e.stopPropagation();
    e.preventDefault();

    if (option.id === "local") {
      ideMessenger.post("config/openProfile", { profileId: option.id });
    } else {
      props.onClose();
      dispatch(setDialogMessage(<AboutAssistantDialog />));
      dispatch(setShowDialog(true));
    }
  }

  function handleClickError(profileId: string) {
    ideMessenger.post("config/openProfile", { profileId });
  }

  return (
    <div className="border-lightgray flex min-w-0 flex-col overflow-x-hidden pt-0">
      <div
        className="pb-1 pl-3.5 pt-3 font-semibold hover:cursor-pointer hover:underline"
        onClick={() => navigate(ROUTES.CONFIG)}
      >
        {selectedOrganization?.name || "Personal"} Assistants
      </div>

      <div className={`max-h-[300px]`}>
        {profiles.map((profile, idx) => (
          <Option
            key={idx}
            idx={idx}
            disabled={!!profile.errors?.length}
            showConfigure={true}
            selected={profile.id === selectedProfile?.id}
            onLink={
              !isLocalProfile(profile)
                ? (e) => handleOptionLink(e, profile.id)
                : undefined
            }
            onConfigure={(e) => handleConfigure(e, profile)}
            errors={profile.errors}
            onClickError={() => handleClickError(profile.id)}
            onClick={() => dispatch(setProfileId(profile.id))}
          >
            <div className="flex min-w-0 items-center">
              <div className="mr-2 h-4 w-4 flex-shrink-0">
                <AssistantIcon assistant={profile} />
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span
                  className="text-lightgray truncate"
                  style={{ fontSize: getFontSize() - 4 }}
                >
                  {profile.fullSlug.ownerSlug}
                </span>
                <span
                  className="flex-1 truncate"
                  style={{ fontSize: getFontSize() - 2 }}
                >
                  {getProfileDisplayText(profile)}
                  {profile.fullSlug.versionSlug &&
                    ` (${profile.fullSlug.versionSlug})`}
                </span>
              </div>
            </div>
          </Option>
        ))}
      </div>

      <div className="mt-auto w-full">
        <OptionDiv key={profiles.length} onClick={onNewAssistant}>
          <div
            className="flex items-center py-0.5"
            style={{ fontSize: getFontSize() - 2 }}
          >
            <PlusIcon className="mr-2 h-4 w-4 flex-shrink-0" />
            New Assistant
          </div>
        </OptionDiv>

        <Divider className="!my-0" />

        <span
          className="block px-3 py-3"
          style={{ color: lightGray, fontSize: getFontSize() - 4 }}
        >
          <code>{getMetaKeyLabel()} ⇧ '</code> to toggle
        </span>
      </div>
    </div>
  );
}
