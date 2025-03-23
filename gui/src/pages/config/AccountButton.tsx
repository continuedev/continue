import { Popover, Transition } from "@headlessui/react";
import { UserCircleIcon } from "@heroicons/react/24/outline";
import { Fragment } from "react";

import { SecondaryButton } from "../../components";
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
      <Popover.Button className="bg-vsc-background hover:bg-vsc-input-background text-vsc-foreground mr-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none">
        <UserCircleIcon className="h-6 w-6" />
      </Popover.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <Popover.Panel className="bg-vsc-input-background absolute right-0 z-10 mt-2 w-[250px] rounded-md border border-zinc-700 p-4 shadow-lg">
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
            <SecondaryButton onClick={logout} className="w-full justify-center">
              Sign out
            </SecondaryButton>
          </div>
        </Popover.Panel>
      </Transition>
    </Popover>
  );
}
