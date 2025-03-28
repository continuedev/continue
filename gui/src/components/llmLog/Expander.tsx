import { ReactNode, useState } from "react";
import "@vscode/codicons/dist/codicon.css";

export interface ExpanderProps {
  label: string;
  children: ReactNode;
}

export default function Expander({ label, children }: ExpanderProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div className="text-base" onClick={() => setExpanded(!expanded)}>
        <div
          className={`codicon codicon-chevron-${expanded ? "down" : "right"}`}
        ></div>
        <span className="align-top text-sm font-bold">{label}</span>
      </div>
      {expanded && <div>{children}</div>}
    </div>
  );
}
