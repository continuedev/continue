import { History } from "../../components/History";
import { getFontSize } from "../../util";
import { HistoryHeader } from "./HistoryHeader";

export default function HistoryPage() {
  return (
    <div className="overflow-y-scroll" style={{ fontSize: getFontSize() }}>
      <HistoryHeader />
      <History />
    </div>
  );
}
