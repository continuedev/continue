import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { useAuth } from "../../context/Auth";
import { cn } from "../../util/cn";
import { AssistantOption } from "./AssistantOption";

interface AssistantOptionsProps {
  selectedProfileId: string | undefined;
  onClose: () => void;
}

export function AssistantOptions({
  selectedProfileId,
  onClose,
}: AssistantOptionsProps) {
  const [loading, setLoading] = useState(false);
  const { profiles, refreshProfiles } = useAuth();

  return (
    <>
      {/* Assistants Section Header */}
      <div className="flex gap-1.5 px-3 pb-1 pt-2">
        <label className="text-vsc-foreground font-semibold">Assistants</label>
        <div
          className="flex cursor-pointer flex-row items-center gap-1 hover:brightness-125"
          onClick={async (e) => {
            e.stopPropagation();
            setLoading(true);
            await refreshProfiles();
            setLoading(false);
          }}
        >
          <ArrowPathIcon
            className={cn(
              "text-description h-2.5 w-2.5",
              loading && "animate-spin-slow",
            )}
          />
        </div>
      </div>

      <div className="thin-scrollbar flex max-h-[300px] flex-col overflow-y-auto">
        {profiles?.map((profile, idx) => (
          <AssistantOption
            key={idx}
            profile={profile}
            onClick={onClose}
            selected={profile.id === selectedProfileId}
          />
        ))}
      </div>
    </>
  );
}
