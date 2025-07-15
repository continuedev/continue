import { ChevronDownIcon } from "@heroicons/react/24/outline";

interface IndicatorBarProps {
  text: string;
  isExpanded: boolean;
}

export function IndicatorBar({ text, isExpanded }: IndicatorBarProps) {
  return (
    <div className="absolute left-0 right-0 top-0 z-10 flex h-8 items-start justify-center pt-1">
      <div
        className="flex items-center gap-2 rounded px-2 py-1 text-[11px] shadow-sm"
        style={{
          backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
          border: "1px solid var(--vscode-widget-border, #454545)",
          color: "var(--vscode-descriptionForeground, #cccccc88)",
        }}
      >
        <span>{text}</span>
        <ChevronDownIcon
          className={`h-3 w-3 text-gray-500 ${isExpanded ? "" : "rotate-180"}`}
        />
      </div>
    </div>
  );
}
