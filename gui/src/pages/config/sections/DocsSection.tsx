import { PlusCircleIcon } from "@heroicons/react/24/outline";
import { useDispatch } from "react-redux";
import { Button, Card } from "../../../components/ui";
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";
import AddDocsDialog from "../../../components/dialogs/AddDocsDialog";
import DocsIndexingStatuses from "./docs/DocsSection";

export function DocsSection() {
  const dispatch = useDispatch();

  function handleAddDocs() {
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <AddDocsDialog />,
      ),
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="mb-0 text-sm font-semibold">Documentation</h3>
        <Button
          onClick={handleAddDocs}
          variant="ghost"
          size="sm"
          className="my-0 h-8 w-8 p-0"
        >
          <PlusCircleIcon className="text-description h-5 w-5" />
        </Button>
      </div>

      <Card>
        <div className="py-6">
          <DocsIndexingStatuses />
        </div>
      </Card>
    </>
  );
}