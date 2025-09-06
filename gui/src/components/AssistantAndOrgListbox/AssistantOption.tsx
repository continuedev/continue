import {
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { ProfileDescription } from "core/config/ProfileLifecycleManager";
import { useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ToolTip } from "../gui/Tooltip";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch } from "../../redux/hooks";
import { setSelectedProfile } from "../../redux/slices/profilesSlice";
import { isLocalProfile } from "../../util";
import { ROUTES } from "../../util/navigation";
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
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);

  const hasFatalErrors = useMemo(() => {
    return !!profile.errors?.find((error) => error.fatal);
  }, [profile.errors]);

  function handleOptionClick() {
    // Always select the agent first (even if it has errors)
    // optimistic update
    dispatch(setSelectedProfile(profile.id));
    // notify core which will handle actual update
    ideMessenger.post("didChangeSelectedProfile", {
      id: profile.id,
    });

    // If the agent has errors, navigate to the agents config page
    if (profile.errors && profile.errors.length > 0) {
      navigate("/config?tab=agents");
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
      <div className="flex w-full items-center justify-between gap-10 py-0.5">
        <div className="flex w-full items-center gap-3">
          <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
            <AssistantIcon assistant={profile} />
          </div>
          <span
            className={`line-clamp-1 flex-1 ${selected ? "font-semibold" : ""} ${profile.errors && profile.errors.length > 0 ? "text-error" : ""}`}
          >
            {profile.title}
          </span>
        </div>
        <div className="flex flex-row items-center gap-1.5">
          {profile.errors && profile.errors?.length > 0 && (
            <ToolTip content="View errors">
              <ExclamationTriangleIcon
                className="text-error h-3.5 w-3.5 flex-shrink-0"
              />
            </ToolTip>
          )}
        </div>
      </div>
    </ListboxOption>
  );
}
