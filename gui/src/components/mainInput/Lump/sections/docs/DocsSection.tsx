import { IndexingStatus } from "core";
import { useMemo } from "react";
import { useDispatch } from "react-redux";
import { useAppSelector } from "../../../../../redux/hooks";
import {
  setDialogMessage,
  setShowDialog,
} from "../../../../../redux/slices/uiSlice";
import AddDocsDialog from "../../../../dialogs/AddDocsDialog";
import DocsIndexingStatus from "./DocsIndexingStatus";

function DocsIndexingStatuses() {
  const dispatch = useDispatch();
  const config = useAppSelector((store) => store.config.config);
  const indexingStatuses = useAppSelector(
    (store) => store.indexing.indexing.statuses,
  );

  const handleAddDocs = () => {
    dispatch(setShowDialog(true));
    dispatch(setDialogMessage(<AddDocsDialog />));
  };

  const sortedConfigDocs = useMemo(() => {
    const sorter = (status: IndexingStatus["status"]) => {
      // TODO - further sorting?
      if (status === "indexing" || status === "paused") return 0;
      if (status === "failed") return 1;
      if (status === "aborted" || status === "pending") return 2;
      return 3;
    };

    const docs = [...(config.docs ?? [])];
    docs.sort((a, b) =>
      sorter(indexingStatuses[b.startUrl]?.status ?? "pending") >
      sorter(indexingStatuses[a.startUrl]?.status ?? "pending")
        ? -1
        : 1,
    );
    return docs;
  }, [config, indexingStatuses]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col gap-1 overflow-y-auto overflow-x-hidden pr-2">
        <div>
          {sortedConfigDocs.length === 0 && (
            <a
              href="#"
              className="cursor-pointer text-blue-500 hover:text-blue-600 hover:underline"
              onClick={(e) => {
                e.preventDefault();
                handleAddDocs();
              }}
            >
              Add Docs
            </a>
          )}
        </div>
        {sortedConfigDocs.map((doc) => {
          return <DocsIndexingStatus key={doc.startUrl} docConfig={doc} />;
        })}
      </div>
      {sortedConfigDocs.length > 0 && (
        <div className="flex justify-start">
          <a
            href="#"
            className="cursor-pointer text-blue-500 hover:text-blue-600 hover:underline"
            onClick={(e) => {
              e.preventDefault();
              handleAddDocs();
            }}
          >
            Add
          </a>
        </div>
      )}
    </div>
  );
}

export default DocsIndexingStatuses;
