import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

interface CollapsibleContainerProps {
  children: React.ReactNode;
  maxHeight?: string;
  className?: string;
}

export function CollapsibleContainer({
  children,
  maxHeight = "max-h-40",
  className = "",
}: CollapsibleContainerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <div className={`overflow-hidden ${isExpanded ? "" : maxHeight}`}>
        {children}
      </div>

      {!isExpanded && (
        <div className="from-editor absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t to-transparent">
          <div
            onClick={() => setIsExpanded(true)}
            className="group flex h-full cursor-pointer items-end justify-center pb-2"
          >
            <span title="Expand to show full content">
              <ChevronDownIcon className="text-lightgray group-hover:text-foreground h-4 w-4" />
            </span>
          </div>
        </div>
      )}

      {isExpanded && (
        <div
          onClick={() => setIsExpanded(false)}
          className="group mt-2 flex cursor-pointer justify-center"
        >
          <span title="Collapse to compact view">
            <ChevronDownIcon className="text-lightgray group-hover:text-foreground h-4 w-4 rotate-180" />
          </span>
        </div>
      )}
    </div>
  );
}
