import {
  ArrowRightStartOnRectangleIcon,
  Cog6ToothIcon,
  UserCircleIcon as UserCircleIconOutline,
} from "@heroicons/react/24/outline";
import { UserCircleIcon as UserCircleIconSolid } from "@heroicons/react/24/solid";
import { isOnPremSession } from "core/control-plane/AuthTypes";
import { useContext } from "react";
import { ToolTip } from "../../../../components/gui/Tooltip";
import {
  Button,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "../../../../components/ui";
import { Divider } from "../../../../components/ui/Divider";
import { useAuth } from "../../../../context/Auth";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";

export function AccountDropdown() {
  const { session, logout, login } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);

  if (isOnPremSession(session)) {
    return null;
  }

  if (!session) {
    return (
      <ToolTip content="Log in" className="text-xs md:!hidden">
        <Button
          variant="ghost"
          className="text-description flex w-full flex-row items-center gap-2 px-2 py-1.5"
          onClick={() => login(false)}
        >
          <UserCircleIconOutline className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />
          <span className="text-description hidden text-xs md:block">
            Log in
          </span>
        </Button>
      </ToolTip>
    );
  }

  return (
    <div>
      <Listbox>
        {({ open }) => (
          <>
            <ListboxButton
              className={`text-description w-full justify-start gap-1 border-none px-2 py-1.5 ${
                open ? "bg-input" : "hover:bg-input bg-inherit"
              }`}
            >
              <UserCircleIconSolid className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />
              <div className="ml-1 flex min-w-0 flex-1 flex-col items-start overflow-hidden">
                <span className="w-full truncate text-xs font-medium hover:brightness-110">
                  {session.account.label}
                </span>
                <span className="text-description-muted w-full truncate text-xs">
                  {session.account.id}
                </span>
              </div>
            </ListboxButton>
            <ListboxOptions anchor="right end">
              {/* Account info section for small screens */}
              <div className="md:hidden">
                <div className="flex items-center gap-2 px-2 py-1">
                  <UserCircleIconSolid className="h-5 w-5 flex-shrink-0" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-xs font-medium">
                      {session.account.label}
                    </span>
                    <span className="text-description-muted truncate text-xs">
                      {session.account.id}
                    </span>
                  </div>
                </div>
                <Divider />
              </div>

              <ListboxOption
                onClick={() =>
                  ideMessenger.post(
                    "openUrl",
                    "https://hub.continue.dev/settings",
                  )
                }
                value="manage-account"
              >
                <div className="flex items-center gap-2 py-0.5">
                  <Cog6ToothIcon className="h-3.5 w-3.5" />
                  <span>Manage Account</span>
                </div>
              </ListboxOption>

              <ListboxOption onClick={logout} value="logout">
                <div className="flex items-center gap-2 py-0.5">
                  <ArrowRightStartOnRectangleIcon className="h-3.5 w-3.5" />
                  <span>Log out</span>
                </div>
              </ListboxOption>
            </ListboxOptions>
          </>
        )}
      </Listbox>
    </div>
  );
}
