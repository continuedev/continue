import { useAuth } from "../../context/Auth";
import { AssistantOption } from "./AssistantOption";

interface AssistantOptionsProps {
  selectedProfileId: string | undefined;
}

export function AssistantOptions({ selectedProfileId }: AssistantOptionsProps) {
  const { profiles } = useAuth();

  return (
    <div className="thin-scrollbar flex max-h-32 flex-col overflow-y-auto">
      {profiles?.length === 0 ? (
        <div className="text-vsc-foreground px-3 py-2 opacity-70">
          No agents found
        </div>
      ) : (
        profiles?.map((profile, idx) => (
          <AssistantOption
            key={idx}
            profile={profile}
            selected={profile.id === selectedProfileId}
          />
        ))
      )}
    </div>
  );
}
