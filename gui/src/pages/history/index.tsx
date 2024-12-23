import { useNavigate } from "react-router-dom";
import { History } from "../../components/History";
import PageHeader from "../../components/PageHeader";
import { getFontSize } from "../../util";

export default function HistoryPage() {
  const navigate = useNavigate();

  return (
    <div className="overflow-y-scroll" style={{ fontSize: getFontSize() }}>
      <PageHeader onClick={() => navigate("/")} title="Chat" />
      <History />
    </div>
  );
}
