import { BuildingOfficeIcon, PlusIcon } from "@heroicons/react/24/outline";
import { ProfileDescription } from "core/config/ConfigHandler";
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { lightGray } from "../..";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { selectProfileThunk } from "../../../redux";
import { useAppDispatch } from "../../../redux/hooks";
import { getFontSize, getMetaKeyLabel, isLocalProfile } from "../../../util";
import { ROUTES } from "../../../util/navigation";
import { ToolTip } from "../../gui/Tooltip";
import { ListboxOption } from "../../ui";
import AssistantIcon from "./AssistantIcon";

import {
  ArrowTopRightOnSquareIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

// const IconBase = styled.div<{ $hovered: boolean }>`

// `;

// const StyledCog6ToothIcon = styled(IconBase).attrs({ as: Cog6ToothIcon })``;
// const StyledArrowTopRightOnSquareIcon = styled(IconBase).attrs({
//   as: ArrowTopRightOnSquareIcon,
// })``;
// const StyledExclamationTriangleIcon = styled(IconBase).attrs({
//   as: ExclamationTriangleIcon,
// })``;

// width: 1.2em;
// height: 1.2em;
// cursor: pointer;
// padding: 4px;
// border-radius: ${defaultBorderRadius};
// opacity: ${(props) => (props.$hovered ? 0.75 : 0)};
// visibility: ${(props) => (props.$hovered ? "visible" : "hidden")};

// &:hover {
//   opacity: 1;
//   background-color: ${lightGray}33;
// }

interface AssistantSelectOptionsProps {
  onClose: () => void;
}

export function AssistantSelectOptions({
  onClose,
}: AssistantSelectOptionsProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const { profiles, selectedProfile, selectedOrganization, session, login } =
    useAuth();
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

  if (!profiles) {
    return null;
  }

  return (
    <div className="border-lightgray flex w-full flex-col overflow-x-hidden pt-0">
      <div className={`max-h-[300px] w-full`}>
        {profiles.map((profile, idx) => {
          const disabled = !!profile.errors?.length;
          const showConfigure = isLocalProfile(profile);
          // const [hovered, setHovered] = useState(false);

          function handleOptionClick(e: any) {
            if (disabled) {
              e.preventDefault();
              e.stopPropagation();
            }
            dispatch(selectProfileThunk(profile.id));
            onClose();
          }

          return (
            <ListboxOption
              value={profile.id}
              key={idx}
              disabled={disabled}
              onClick={!disabled ? handleOptionClick : undefined}
            >
              <div className="flex w-full flex-col gap-0.5">
                <div className="flex w-full items-center justify-between">
                  <div className="flex w-full items-center">
                    <div className="mr-2 h-4 w-4 flex-shrink-0">
                      <AssistantIcon assistant={profile} />
                    </div>
                    <span
                      className="flex-1 truncate"
                      style={{ fontSize: getFontSize() - 2 }}
                    >
                      {profile.title}
                    </span>
                  </div>
                  <div className="ml-2 flex items-center">
                    {!profile.errors?.length ? (
                      showConfigure ? (
                        <Cog6ToothIcon
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleConfigure(profile);
                          }}
                        />
                      ) : (
                        <ArrowTopRightOnSquareIcon
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleConfigure(profile);
                          }}
                        />
                      )
                    ) : (
                      <>
                        <ExclamationTriangleIcon
                          data-tooltip-id={`${idx}-errors-tooltip`}
                          className="cursor-pointer text-red-500"
                          onClick={() => handleClickError(profile.id)}
                        />
                        <ToolTip id={`${idx}-errors-tooltip`}>
                          <div className="font-semibold">Errors</div>
                          {JSON.stringify(profile.errors, null, 2)}
                        </ToolTip>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </ListboxOption>
          );
        })}
      </div>

      <div className="mt-auto w-full">
        <ListboxOption
          value={"new-assistant"}
          onClick={session ? onNewAssistant : () => login(false)}
        >
          <div
            className="flex items-center py-0.5"
            style={{ fontSize: getFontSize() - 2 }}
          >
            <PlusIcon className="mr-2 h-4 w-4 flex-shrink-0" />
            New Assistant
          </div>
        </ListboxOption>

        <div className="bg-lightgray my-0 h-[0.5px]" />

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
              <img
                src={selectedOrganization.iconUrl}
                className="h-4 w-4 rounded-full"
              />
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
