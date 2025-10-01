import { ChevronDownIcon, PlusIcon } from "@heroicons/react/24/outline";
import { ToolTip } from "./gui/Tooltip";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "./ui";

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownButtonProps {
  title: string;
  options: DropdownOption[];
  onOptionClick: (value: string) => void;
  addButtonTooltip?: string;
  className?: string;
  variant?: "default" | "sm";
}

export function DropdownButton({
  title,
  options,
  onOptionClick,
  addButtonTooltip,
  className = "",
  variant = "default",
}: DropdownButtonProps) {
  const isSmall = variant === "sm";
  const titleSize = isSmall ? "text-sm font-semibold" : "text-xl font-semibold";
  const marginBottom = isSmall ? "mb-2" : "mb-4";

  return (
    <div
      className={`${marginBottom} flex items-center justify-between ${className}`}
    >
      <h3 className={`my-0 ${titleSize}`}>{title}</h3>
      <Listbox value={null} onChange={() => {}}>
        <div className="relative">
          <ToolTip content={addButtonTooltip}>
            <ListboxButton
              className={`ring-offset-background focus-visible:ring-ring border-description hover:enabled:bg-input hover:enabled:text-foreground text-description inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-solid bg-transparent px-1.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50`}
              aria-label={addButtonTooltip}
            >
              <PlusIcon className="h-3 w-3" />
              <ChevronDownIcon className="h-3 w-3" />
            </ListboxButton>
          </ToolTip>
          <ListboxOptions className="min-w-32 max-w-36" anchor="bottom end">
            {options.map((option) => (
              <ListboxOption
                key={option.value}
                value={option.value}
                className={({ active }: { active: boolean }) =>
                  `relative flex cursor-default select-none items-center gap-3 py-2 pl-4 pr-4 ${
                    active
                      ? "bg-list-active text-list-active-foreground"
                      : "text-foreground"
                  }`
                }
                onClick={() => onOptionClick(option.value)}
              >
                <span className="block truncate">{option.label}</span>
              </ListboxOption>
            ))}
          </ListboxOptions>
        </div>
      </Listbox>
    </div>
  );
}
