import { ChevronDownIcon } from "@heroicons/react/24/outline";
import type { ProfileDescription } from "core/config/ConfigHandler";
import { fontSize } from "../../util";
import { useLump } from "../mainInput/Lump/LumpContext";
import { ListboxButton } from "../ui";
import { AssistantIcon } from "./AssistantIcon";

interface SelectedAssistantButtonProps {
  selectedProfile: ProfileDescription;
}

export function SelectedAssistantButton({
  selectedProfile,
}: SelectedAssistantButtonProps) {
  const { isToolbarExpanded } = useLump();
  return (
    <ListboxButton
      data-testid="assistant-select-button"
      className="text-description border-none bg-transparent hover:brightness-125"
      style={{ fontSize: fontSize(-3) }}
    >
      <div className="flex flex-row items-center gap-1.5">
        <div className="h-3 w-3 flex-shrink-0 select-none">
          <AssistantIcon size={3} assistant={selectedProfile} />
        </div>
        <span
          className={`line-clamp-1 select-none break-all ${isToolbarExpanded ? "xs:hidden sm:line-clamp-1" : ""}`}
        >
          {selectedProfile.title}
        </span>
      </div>
      <ChevronDownIcon
        className="h-2 w-2 flex-shrink-0 select-none"
        aria-hidden="true"
      />
    </ListboxButton>
  );
}
