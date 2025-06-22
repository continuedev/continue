import { ScopeSelect } from "./ScopeSelect";

export function OrganizationInfo() {
  return (
    <div className="border-border border-b px-2 py-3">
      <div className="flex flex-col gap-1">
        <label className="text-vsc-foreground ml-2 pb-0.5 font-semibold">
          Organization
        </label>
        <ScopeSelect />
      </div>
    </div>
  );
}
