import { useAuth } from "../../context/Auth";
import { OrganizationOption } from "./OrganizationOption";

export function OrganizationOptions() {
  const { organizations } = useAuth();

  return (
    <div className="thin-scrollbar flex max-h-24 flex-col overflow-y-auto">
      {organizations.map((org) => (
        <OrganizationOption key={org.id} organization={org} />
      ))}
    </div>
  );
}
