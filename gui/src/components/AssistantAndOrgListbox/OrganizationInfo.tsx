import { useAuth } from "../../context/Auth";
import { ScopeSelect } from "./ScopeSelect";

export function OrganizationInfo() {
  const { session } = useAuth();

  return (
    <div className="border-border border-b px-2 py-3">
      <div className="flex flex-col gap-1">
        <div className="ml-2 flex items-center gap-2 pb-0.5">
          <label className="text-vsc-foreground font-semibold">
            Organization
          </label>
          {!session && (
            <span className="text-description-muted">(Signed out)</span>
          )}
        </div>
        <ScopeSelect />
      </div>
    </div>
  );
}
