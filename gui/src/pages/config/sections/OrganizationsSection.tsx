import { Card } from "../../../components/ui";

export function OrganizationsSection() {
  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="mb-0 text-xl font-semibold">Organizations</h2>
        </div>
      </div>
      <Card>
        <div className="text-description py-8 text-center text-sm">
          Organizations are not available in this version.
        </div>
      </Card>
    </>
  );
}
