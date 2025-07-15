import { ChevronDownIcon } from "@heroicons/react/24/outline";

interface IndicatorBarProps {
  text: string;
  isExpanded: boolean;
}

export function IndicatorBar({ 
  text,
  isExpanded
}: IndicatorBarProps) {
  return (
    <div className="absolute top-0 left-0 right-0 flex items-start justify-center pt-1 h-8 z-10">
      <div 
        className="flex items-center gap-2 rounded px-2 py-1 shadow-sm text-[11px]"
        style={{
          backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
          border: '1px solid var(--vscode-widget-border, #454545)',
          color: 'var(--vscode-descriptionForeground, #cccccc88)'
        }}
      >
        <span>{text}</span>
        <ChevronDownIcon 
          className={`h-3 w-3 text-gray-500 ${isExpanded ? '' : 'rotate-180'}`} 
        />
      </div>
    </div>
  );
}