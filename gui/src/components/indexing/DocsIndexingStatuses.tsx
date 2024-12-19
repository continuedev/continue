import { useDispatch } from "react-redux";
import { SecondaryButton } from "..";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import AddDocsDialog from "../dialogs/AddDocsDialog";
import DocsIndexingStatus from "./DocsIndexingStatus";
import { useAppSelector } from "../../redux/hooks";

function DocsIndexingStatuses() {
  const dispatch = useDispatch();
  const config = useAppSelector((store) => store.config.config);
  const configDocs = config.docs ?? [];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-row items-center justify-between">
        <h3 className="mb-1 mt-0 text-xl">@docs indexes</h3>
        {configDocs.length ? (
          <SecondaryButton
            className="flex h-7 flex-col items-center justify-center"
            onClick={() => {
              dispatch(setShowDialog(true));
              dispatch(setDialogMessage(<AddDocsDialog />));
            }}
          >
            Add
          </SecondaryButton>
        ) : null}
      </div>
      <span className="text-xs text-stone-500">
        {configDocs.length
          ? "Manage your documentation sources"
          : "No docs yet"}
      </span>
      <div className="flex max-h-[170px] flex-col gap-1 overflow-y-auto overflow-x-hidden pr-2">
        <div>
          {configDocs.length === 0 && (
            <SecondaryButton
              className="flex h-7 flex-col items-center justify-center"
              onClick={() => {
                dispatch(setShowDialog(true));
                dispatch(setDialogMessage(<AddDocsDialog />));
              }}
            >
              Add Docs
            </SecondaryButton>
          )}
        </div>
        {configDocs.map((doc) => {
          return <DocsIndexingStatus key={doc.startUrl} docConfig={doc} />;
        })}
      </div>
    </div>
  );
}

export default DocsIndexingStatuses;
