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
    <>
      <div className="flex gap-1.5 px-3 pb-1 pt-2">
        <label className="text-vsc-foreground font-semibold">Assistants</label>
        <div className="flex cursor-pointer flex-row items-center gap-1 hover:brightness-125"></div>
      </div>

      <div className="thin-scrollbar flex max-h-[300px] flex-col overflow-y-auto">
        {profiles?.length === 0 ? (
          <div className="text-vsc-foreground px-3 py-2 opacity-70">
            No assistants found
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
    </>
  );
}
