import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { UserCircleIcon } from "@heroicons/react/24/solid";
import { isOnPremSession } from "core/control-plane/AuthTypes";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "../../components/ui";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../context/Auth";
import { selectCurrentOrg } from "../../redux";
import { useAppSelector } from "../../redux/hooks";
import { cn } from "../../util/cn";
import { ScopeSelect } from "./ScopeSelect";

export function AccountButton() {
  const { session, logout, login, organizations, refreshProfiles } = useAuth();
  const selectedOrg = useAppSelector(selectCurrentOrg);
  const configLoading = useAppSelector((store) => store.config.loading);

  if (!session) {
    return (
      <Button
        variant="outline"
        className="mb-1 whitespace-nowrap py-1"
        onClick={() => login(false)}
      >
        Sign in
      </Button>
    );
  }

  // No login button for on-prem deployments
  if (isOnPremSession(session)) {
    return null;
  }

  return (
    <Popover className="relative">
      {({ close }) => (
        <>
          <PopoverButton className="bg-vsc-background hover:bg-vsc-input-background text-vsc-foreground my-0.5 flex cursor-pointer rounded-md border-none px-2">
            <div className="flex items-center gap-1.5">
              <span className="font-medium">
                {selectedOrg === null ? "Personal" : selectedOrg.name}
              </span>
              <UserCircleIcon className="h-6 w-6" />
            </div>
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
                    <div className="flex items-center justify-between">
                      <label className="text-vsc-foreground text-xs">
                        Organization
                      </label>
                      <div
                        className="mt-0.5 cursor-pointer hover:brightness-125"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await refreshProfiles();
                        }}
                      >
                        <ArrowPathIcon
                          className={cn(
                            "text-description h-2.5 w-2.5",
                            configLoading && "animate-spin-slow",
                          )}
                        />
                      </div>
                    </div>
                    <ScopeSelect onSelect={close} />
                  </div>
                )}

                <Button
                  variant="ghost"
                  onClick={logout}
                  className="!mx-0 w-full"
                >
                  Sign out
                </Button>
              </div>
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  );
}
