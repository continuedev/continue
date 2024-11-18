import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../redux/store";
import IndexingStatusViewer from "./IndexingStatus";
import { Button } from "..";
import {
  setDialogMessage,
  setShowDialog,
} from "../../redux/slices/uiStateSlice";
import AddDocsDialog from "../dialogs/AddDocsDialog";

function IndexingStatuses() {
  const indexingStatuses = useSelector(
    (store: RootState) => store.state.indexingStatuses,
  );
  const docsStatuses = useMemo(() => {
    const docs = Object.values(indexingStatuses).filter(
      (status) => status.type === "docs" && status.status !== "deleted",
    );

    return [];
    return docs;
  }, [indexingStatuses]);
  const dispatch = useDispatch();

  return (
    <div className="flex flex-col gap-1">
      <h3 className="mb-1 mt-0 text-xl">@docs indexes</h3>
      <span className="text-xs text-stone-500">
        Manage your documentation sources
      </span>
      {docsStatuses.length ? (
        docsStatuses.map((status) => {
          return <IndexingStatusViewer key={status.id} status={status} />;
        })
      ) : (
        <Button
          onClick={() => {
            dispatch(setShowDialog(true));
            dispatch(setDialogMessage(<AddDocsDialog />));
          }}
        >
          Add Docs
        </Button>
      )}
    </div>
  );
}

export default IndexingStatuses;
