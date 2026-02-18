import { useAuth } from "../../context/Auth";
import { AssistantOption } from "./AssistantOption";

interface AssistantOptionsProps {
  selectedProfileId: string | undefined;
  onClose: () => void;
}

export function AssistantOptions({
  selectedProfileId,
  onClose,
}: AssistantOptionsProps) {
  const { profiles } = useAuth();

  return (
    <div className="thin-scrollbar flex max-h-32 flex-col overflow-y-auto">
      {profiles?.length === 0 ? (
        <div className="text-vsc-foreground px-3 py-2 opacity-70">
          No config found
        </div>
      ) : (
        profiles?.map((profile, idx) => (
          <AssistantOption
            key={idx}
            profile={profile}
            onClick={onClose}
            selected={profile.id === selectedProfileId}
          />
        ))
      )}
    </div>
  );
}
