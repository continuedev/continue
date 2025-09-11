import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { ProfileDescription } from "core/config/ProfileLifecycleManager";
import { useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch } from "../../redux/hooks";
import { setSelectedProfile } from "../../redux/slices/profilesSlice";
import { CONFIG_ROUTES } from "../../util/navigation";
import { ToolTip } from "../gui/Tooltip";
import { Button, ListboxOption } from "../ui";
import { AssistantIcon } from "./AssistantIcon";

interface AssistantOptionProps {
  profile: ProfileDescription;
  selected: boolean;
}

export function AssistantOption({ profile, selected }: AssistantOptionProps) {
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
              <Button
                variant="ghost"
                size="sm"
                className="text-error hover:enabled:text-error my-0 h-4 w-4 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(CONFIG_ROUTES.AGENTS);
                }}
              >
                <ExclamationTriangleIcon className="h-3.5 w-3.5" />
              </Button>
            </ToolTip>
          )}
        </div>
      </div>
    </ListboxOption>
  );
}
