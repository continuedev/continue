import {
  ArrowRightEndOnRectangleIcon,
  UserCircleIcon as UserCircleIconOutline,
} from "@heroicons/react/24/outline";
import { isOnPremSession } from "core/control-plane/AuthTypes";
import { useAuth } from "../../context/Auth";
import { ListboxOption, useFontSize } from "../ui";

interface AccountOptionProps {
  onClose: () => void;
}

export function AccountOption({ onClose }: AccountOptionProps) {
  const { session, logout, login } = useAuth();
  const tinyFont = useFontSize(-4);

  // No account option for on-prem deployments
  if (session && isOnPremSession(session)) {
    return null;
  }

  async function handleClick() {
    if (session) {
      logout();
    } else {
      await login(false);
    }
    onClose();
  }

  return (
    <ListboxOption
      value={session ? "log-out" : "sign-in"}
      fontSizeModifier={-2}
      className="border-border border-b px-2 py-1.5"
      onClick={handleClick}
    >
      <div
        className="text-description flex flex-row items-center"
        style={{ fontSize: tinyFont }}
      >
        {session ? (
          <ArrowRightEndOnRectangleIcon className="mr-1 h-3 w-3" />
        ) : (
          <UserCircleIconOutline className="mr-1 h-3 w-3" />
        )}
        {session ? "Log out" : "Sign in"}
      </div>
    </ListboxOption>
  );
}
