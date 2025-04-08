import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { ReactNode, useState } from "react";

export interface ExpanderProps {
  label: string;
  children: ReactNode;
}

export default function Expander({ label, children }: ExpanderProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div className="text-base" onClick={() => setExpanded(!expanded)}>
        {expanded ? (
          <ChevronDownIcon className="h-[16px] w-[16px]" />
        ) : (
          <ChevronRightIcon className="h-[16px] w-[16px]" />
        )}{" "}
        <span className="align-top text-sm font-bold">{label}</span>
      </div>
      {expanded && <div>{children}</div>}
    </div>
  );
}
