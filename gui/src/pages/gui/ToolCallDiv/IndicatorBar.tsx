import { ChevronDownIcon } from "@heroicons/react/24/outline";

interface IndicatorBarProps {
  text: string;
  isExpanded: boolean;
}

export function IndicatorBar({ text, isExpanded }: IndicatorBarProps) {
  return (
    <div className="absolute left-0 right-0 top-0 z-10 flex h-8 items-start justify-center pt-1">
      <div className="flex items-center gap-2 rounded border border-border bg-editor px-2 py-1 text-[11px] text-description shadow-sm">
        <span>{text}</span>
        <ChevronDownIcon
          className={`h-3 w-3 text-description ${isExpanded ? "" : "rotate-180"}`}
        />
      </div>
    </div>
  );
}