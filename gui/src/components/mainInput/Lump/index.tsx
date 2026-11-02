import { LumpToolbar } from "./LumpToolbar/LumpToolbar";

/**
 * Simplified toolbar component that only shows the toolbar without expansion
 */
export function Lump() {
  return (
    <div className="bg-input rounded-t-default border-command-border mx-1 min-w-0 overflow-hidden border-l border-r border-t">
      <div className="min-w-0 px-1 py-0.5">
        <LumpToolbar />
      </div>
    </div>
  );
}
