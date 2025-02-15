import { BuildingOfficeIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { lightGray } from "../..";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch } from "../../../redux/hooks";
import { getFontSize, getMetaKeyLabel, isLocalProfile } from "../../../util";
import { ROUTES } from "../../../util/navigation";
import AssistantIcon from "./AssistantIcon";
import { Divider, Option, OptionDiv } from "./shared";
import { getProfileDisplayText } from "./utils";
import { ProfileDescription } from "core/config/ConfigHandler";
import { selectProfileThunk } from "../../../redux/thunks/profileAndOrg";

interface AssistantSelectOptionsProps {
  onClose: () => void;
}

export function AssistantSelectOptions({
  onClose,
}: AssistantSelectOptionsProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const { profiles, selectedProfile, selectedOrganization } = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  function onNewAssistant() {
    ideMessenger.post("controlPlane/openUrl", {
      path: "new",
      orgSlug: selectedOrganization?.slug,
    });
    onClose();
  }

  function handleConfigure(profile: ProfileDescription) {
    ideMessenger.post("config/openProfile", { profileId: profile.id });
    onClose();
  }

  function handleClickError(profileId: string) {
    ideMessenger.post("config/openProfile", { profileId });
    onClose();
  }

  return (
    <div className="border-lightgray flex min-w-0 flex-col overflow-x-hidden pt-0">
      <div className={`max-h-[300px]`}>
        {profiles.map((profile, idx) => {
          return (
            <Option
              key={idx}
              idx={idx}
              disabled={!!profile.errors?.length}
              showConfigure={isLocalProfile(profile)}
              selected={profile.id === selectedProfile?.id}
              onOpenConfig={() => {
                handleConfigure(profile);
              }}
              errors={profile.errors}
              onClickError={() => handleClickError(profile.id)}
              onClick={() => {
                dispatch(selectProfileThunk(profile.id));
                onClose();
              }}
            >
              <div className="flex min-w-0 items-center">
                <div className="mr-2 h-4 w-4 flex-shrink-0">
                  <AssistantIcon assistant={profile} />
                </div>
                <span
                  className="flex-1 truncate"
                  style={{ fontSize: getFontSize() - 2 }}
                >
                  {getProfileDisplayText(profile)}
                  {profile.fullSlug.versionSlug &&
                    ` (${profile.fullSlug.versionSlug})`}
                </span>
              </div>
            </Option>
          );
        })}
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

        <div
          className="flex items-center justify-between p-2"
          style={{ color: lightGray, fontSize: getFontSize() - 4 }}
        >
          <span className="block">
            <code>{getMetaKeyLabel()} ⇧ '</code> to toggle
          </span>
          <div
            className="flex items-center gap-1"
            onClick={() => navigate(ROUTES.CONFIG)}
          >
            {selectedOrganization?.iconUrl ? (
              <img src={selectedOrganization.iconUrl} className="h-4 w-4" />
            ) : (
              <BuildingOfficeIcon className="h-4 w-4" />
            )}
            <span className="hover:cursor-pointer hover:underline">
              {selectedOrganization?.name || "Personal"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
