import { useDispatch } from "react-redux";
import AddDocsDialog from "../../../components/dialogs/AddDocsDialog";
import { Card, Divider } from "../../../components/ui";
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";
import { ConfigHeader } from "../components/ConfigHeader";
import DocsIndexingStatuses from "./docs/DocsSection";

export function DocsSection() {
  const dispatch = useDispatch();

  function handleAddDocs() {
    dispatch(setShowDialog(true));
    dispatch(setDialogMessage(<AddDocsDialog />));
  }

  return (
    <div>
      <ConfigHeader
        title="Documentation"
        onAddClick={handleAddDocs}
        addButtonTooltip="Add documentation"
        variant="sm"
      />

      <Card>
        <div className="py-2">
          <DocsIndexingStatuses />
        </div>
      </Card>
    </div>
  );
}
