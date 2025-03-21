import {
  ArrowTopRightOnSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { SiteIndexingConfig } from "core";
import { useContext, useMemo, useState } from "react";
import { IdeMessengerContext } from "../../../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../../../redux/hooks";
import { updateIndexingStatus } from "../../../../../redux/slices/indexingSlice";
import {
  setDialogMessage,
  setShowDialog,
} from "../../../../../redux/slices/uiSlice";
import ConfirmationDialog from "../../../../dialogs/ConfirmationDialog";
import { StatusIndicator } from "./StatusIndicator";

interface IndexingStatusViewerProps {
  docConfig: SiteIndexingConfig;
}

function DocsIndexingStatus({ docConfig }: IndexingStatusViewerProps) {
  const config = useAppSelector((store) => store.config.config);
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();

  const status = useAppSelector(
    (store) => store.indexing.indexing.statuses[docConfig.startUrl],
  );

  const reIndex = () =>
    ideMessenger.post("indexing/reindex", {
      type: "docs",
      id: docConfig.startUrl,
    });

  const abort = () => {
    ideMessenger.post("indexing/abort", {
      type: "docs",
      id: docConfig.startUrl,
    });
    // Optimistic abort status
    if (status) {
      dispatch(
        updateIndexingStatus({ ...status, status: "aborted", progress: 0 }),
      );
    }
  };

  const [hasDeleted, setHasDeleted] = useState(false); // simple alternative to optimistic redux update
  const onDelete = () => {
    // optimistic update
    dispatch(
      setDialogMessage(
        <ConfirmationDialog
          title={`Delete ${docConfig.title}`}
          text={`Are you sure you want to remove ${docConfig.title} from your configuration?`}
          onConfirm={() => {
            ideMessenger.post("context/removeDocs", {
              startUrl: docConfig.startUrl,
            });
            setHasDeleted(true);
          }}
        />,
      ),
    );
    dispatch(setShowDialog(true));
  };

  const progressPercentage = useMemo(() => {
    if (!status) {
      return 0;
    }
    return Math.min(100, Math.max(0, status.progress * 100)).toFixed(0);
  }, [status?.progress]);

  const showProgressPercentage = progressPercentage !== "100";

  if (hasDeleted) return null;

  return (
    <div className="mt-2 flex w-full flex-col">
      <div
        className={`flex flex-row items-center justify-between gap-2 text-sm`}
      >
        <div
          className={`flex flex-row items-center gap-2 ${status?.url ? "cursor-pointer hover:underline" : ""}`}
          onClick={() => {
            if (status?.url) {
              ideMessenger.post("openUrl", status.url);
            }
          }}
        >
          {docConfig.faviconUrl ? (
            <img
              src={docConfig.faviconUrl}
              alt="doc icon"
              className="h-4 w-4"
            />
          ) : null}
          <p className="lines lines-1 m-0 p-0 text-left">
            {docConfig.title ?? docConfig.startUrl}
          </p>
          <ArrowTopRightOnSquareIcon className="mb-0.5 h-3 w-3 text-stone-500" />
        </div>
        {status?.status === "pending" ? (
          <div className="text-xs text-stone-500">Pending...</div>
        ) : (
          <div className="flex flex-row items-center gap-1 text-stone-500">
            {true && <span className="text-xs">{progressPercentage}%</span>}

            {status?.status !== "indexing" ? (
              <TrashIcon
                className="h-4 w-4 cursor-pointer text-stone-500 hover:brightness-125"
                onClick={onDelete}
              />
            ) : null}
            <StatusIndicator status={status?.status} />
          </div>
        )}
      </div>
    </div>
  );
}

export default DocsIndexingStatus;
