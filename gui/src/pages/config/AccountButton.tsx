import { UserCircleIcon } from "@heroicons/react/24/outline";

import { SecondaryButton } from "../../components";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "../../components/ui";
import { useAuth } from "../../context/Auth";
import { ScopeSelect } from "./ScopeSelect";

export function AccountButton() {
  const { session, logout, login, organizations } = useAuth();

  if (!session) {
    return (
      <SecondaryButton onClick={() => login(false)}>Sign in</SecondaryButton>
    );
  }

  return (
    <Popover className="relative">
      <PopoverButton className="bg-vsc-background hover:bg-vsc-input-background text-vsc-foreground flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none">
        <UserCircleIcon className="h-6 w-6" />
      </PopoverButton>

      <Transition>
        <PopoverPanel className="bg-vsc-input-background xs:p-4 absolute right-0 mt-1 rounded-md border border-zinc-700 p-2 shadow-lg">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col">
              <span className="font-medium">{session.account.label}</span>
              <span className="text-lightgray text-sm">
                {session.account.id}
              </span>
            </div>
            {organizations.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-vsc-foreground text-sm">
                  Organization
                </label>
                <ScopeSelect />
              </div>
            )}
            <SecondaryButton onClick={logout} className="">
              Sign out
            </SecondaryButton>
          </div>
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}
