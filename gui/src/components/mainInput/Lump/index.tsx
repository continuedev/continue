import { RecentlyBlocked } from "../../RecentlyBlocked";
import { YoloBanner } from "../../ApprovalSelect";
import { LumpToolbar } from "./LumpToolbar/LumpToolbar";

/**
 * Simplified toolbar component that only shows the toolbar without expansion
 */
export function Lump() {
  return (
    <div className="mx-1.5 rounded-t-default bg-input">
      <RecentlyBlocked />
      <YoloBanner />
      <div className="px-1 py-0.5 xs:px-2">
        <LumpToolbar />
      </div>
    </div>
  );
}
