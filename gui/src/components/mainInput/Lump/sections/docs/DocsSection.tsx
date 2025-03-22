import { PlusIcon } from "@heroicons/react/24/outline";
import { IndexingStatus } from "core";
import { useMemo } from "react";
import { useDispatch } from "react-redux";
import { useAppSelector } from "../../../../../redux/hooks";
import {
  setDialogMessage,
  setShowDialog,
} from "../../../../../redux/slices/uiSlice";
import { getFontSize } from "../../../../../util";
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
      if (status === "complete") return 0;
      if (status === "indexing" || status === "paused") return 1;
      if (status === "failed") return 2;
      if (status === "aborted" || status === "pending") return 3;
      return 4;
    };

    const docs = [...(config.docs ?? [])];
    docs.sort((a, b) => {
      const statusA = indexingStatuses[a.startUrl]?.status ?? "pending";
      const statusB = indexingStatuses[b.startUrl]?.status ?? "pending";

      // First, compare by status
      const statusCompare = sorter(statusA) - sorter(statusB);
      if (statusCompare !== 0) return statusCompare;

      // If status is the same, sort by presence of icon
      const hasIconA = !!a.faviconUrl;
      const hasIconB = !!b.faviconUrl;
      return hasIconB === hasIconA ? 0 : hasIconB ? 1 : -1;
    });
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
        <div
          className="cursor-pointer rounded px-2 py-1 text-center text-gray-400 hover:text-gray-300"
          style={{
            fontSize: `${getFontSize() - 3}px`,
          }}
          onClick={(e) => {
            e.preventDefault();
            handleAddDocs();
          }}
        >
          <div className="flex items-center justify-center gap-1">
            <PlusIcon className="h-3 w-3" /> Add
          </div>
        </div>
      )}
    </div>
  );
}

export default DocsIndexingStatuses;
