import { PlusIcon } from "@heroicons/react/24/outline";
import { ToolTip } from "../../components/gui/Tooltip";
import { Button } from "../../components/ui";

interface ConfigHeaderProps {
  title: string;
  subtext?: string;
  onAddClick?: () => void;
  addButtonTooltip?: string;
  className?: string;
}

export function ConfigHeader({
  title,
  subtext,
  onAddClick,
  addButtonTooltip = "Add item",
  className = "",
}: ConfigHeaderProps) {
  return (
    <div className={`mb-8 flex items-center justify-between ${className}`}>
      <div className="flex flex-col">
        <h2 className="mb-0 text-xl font-semibold">{title}</h2>
        {subtext && <p className="text-description mt-1 text-sm">{subtext}</p>}
      </div>
      {onAddClick && (
        <ToolTip content={addButtonTooltip}>
          <Button
            onClick={onAddClick}
            variant="outline"
            className="border-description h-6 w-6 rounded-full p-0"
          >
            <PlusIcon className="h-3 w-3" />
          </Button>
        </ToolTip>
      )}
    </div>
  );
}
