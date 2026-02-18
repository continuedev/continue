import { PlusIcon } from "@heroicons/react/24/outline";
import { ToolTip } from "../../../components/gui/Tooltip";
import { Button } from "../../../components/ui";
import { cn } from "../../../util/cn";

interface ConfigHeaderProps {
  title: string;
  subtext?: string;
  onAddClick?: () => void;
  addButtonTooltip?: string;
  className?: string;
  variant?: "default" | "sm";
  showAddButton?: boolean;
}

export function ConfigHeader({
  title,
  subtext,
  onAddClick,
  addButtonTooltip = "Add item",
  className = "",
  variant = "default",
  showAddButton = true,
}: ConfigHeaderProps) {
  const isSmall = variant === "sm";
  const marginBottom = isSmall ? "mb-4" : "mb-6";
  const titleSize = isSmall ? "text-sm font-semibold" : "text-xl font-semibold";
  const HeadingTag = isSmall ? "h3" : "h2";

  return (
    <div
      className={cn(
        `${marginBottom} flex items-center justify-between`,
        className,
      )}
    >
      <div className="flex flex-col">
        <HeadingTag className={`my-0 ${titleSize}`}>{title}</HeadingTag>
        {subtext && <p className="text-description mt-1 text-sm">{subtext}</p>}
      </div>
      {showAddButton && onAddClick && (
        <ToolTip content={addButtonTooltip}>
          <Button
            onClick={onAddClick}
            variant="icon"
            size={isSmall ? "sm" : "lg"}
          >
            <PlusIcon className={isSmall ? "h-2.5 w-2.5" : "h-3 w-3"} />
          </Button>
        </ToolTip>
      )}
    </div>
  );
}
