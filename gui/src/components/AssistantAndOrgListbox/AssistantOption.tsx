import {
  ArrowTopRightOnSquareIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { ProfileDescription } from "core/config/ProfileLifecycleManager";
import { useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch } from "../../redux/hooks";
import { setSelectedProfile } from "../../redux/slices/profilesSlice";
import { isLocalProfile } from "../../util";
import { ROUTES } from "../../util/navigation";
import { useLump } from "../mainInput/Lump/LumpContext";
import { ListboxOption, useFontSize } from "../ui";
import { AssistantIcon } from "./AssistantIcon";

interface AssistantOptionProps {
  profile: ProfileDescription;
  selected: boolean;
  onClick: () => void;
}

export function AssistantOption({
  profile,
  selected,
  onClick,
}: AssistantOptionProps) {
  const tinyFont = useFontSize(-4);
  const navigate = useNavigate();
  const { setSelectedSection } = useLump();
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);

  const hasFatalErrors = useMemo(() => {
    return !!profile.errors?.find((error) => error.fatal);
  }, [profile.errors]);

  function handleOptionClick() {
    // optimistic update
    dispatch(setSelectedProfile(profile.id));
    // notify core which will handle actual update
    ideMessenger.post("didChangeSelectedProfile", {
      id: profile.id,
    });
    onClick();
  }

  function handleConfigure() {
    ideMessenger.post("config/openProfile", { profileId: profile.id });
    onClick();
  }

  function handleClickError() {
    if (profile.id === "local") {
      navigate(ROUTES.HOME);
      setSelectedSection("error");
    } else {
      ideMessenger.post("config/openProfile", { profileId: profile.id });
    }
    onClick();
  }

  return (
    <ListboxOption
      value={profile.id}
      disabled={hasFatalErrors}
      onClick={!hasFatalErrors ? handleOptionClick : undefined}
      fontSizeModifier={-2}
      className={selected ? "bg-list-active text-list-active-foreground" : ""}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex w-full items-center gap-2">
          <div className="flex h-4 w-4 flex-shrink-0">
            <AssistantIcon size={3.5} assistant={profile} />
          </div>
          <span
            className={`line-clamp-1 flex-1 ${selected ? "font-semibold" : ""}`}
          >
            {profile.title}
          </span>
        </div>
        <div className="flex flex-row items-center gap-1">
          {profile.errors && profile.errors?.length > 0 && (
            <ExclamationTriangleIcon
              data-tooltip-id={`${profile.id}-errors-tooltip`}
              className="text-error h-3 w-3 flex-shrink-0 cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleClickError();
              }}
            />
          )}
          {isLocalProfile(profile) ? (
            <Cog6ToothIcon
              className="text-description h-3 w-3 flex-shrink-0 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleConfigure();
              }}
            />
          ) : (
            <ArrowTopRightOnSquareIcon
              className="text-description h-3 w-3 flex-shrink-0 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleConfigure();
              }}
            />
          )}
        </div>
      </div>
    </ListboxOption>
  );
}
