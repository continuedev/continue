import { useDispatch } from "react-redux";
import AddDocsDialog from "../../../components/dialogs/AddDocsDialog";
import { Card, Divider } from "../../../components/ui";
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";
import { ConfigHeader } from "../components/ConfigHeader";
import DocsIndexingStatuses from "./docs/DocsSection";
import { useTranslation } from "react-i18next";

export function DocsSection() {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  function handleAddDocs() {
    dispatch(setShowDialog(true));
    dispatch(setDialogMessage(<AddDocsDialog />));
  }

  return (
    <div>
      <ConfigHeader
        title={t("DocsSection.Documentation")}
        onAddClick={handleAddDocs}
        addButtonTooltip={t("DocsSection.AddDocumentation")}
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
