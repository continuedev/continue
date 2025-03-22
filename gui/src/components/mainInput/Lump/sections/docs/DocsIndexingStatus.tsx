import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  StopIcon,
} from "@heroicons/react/24/outline";
import { SiteIndexingConfig } from "core";
import { useContext, useMemo, useState } from "react";
import { useAuth } from "../../../../../context/Auth";
import { IdeMessengerContext } from "../../../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../../../redux/hooks";
import { updateIndexingStatus } from "../../../../../redux/slices/indexingSlice";
import {
  setDialogMessage,
  setShowDialog,
} from "../../../../../redux/slices/uiSlice";
import { getFontSize } from "../../../../../util";
import ConfirmationDialog from "../../../../dialogs/ConfirmationDialog";
import { StatusIndicator } from "./StatusIndicator";

interface IndexingStatusViewerProps {
  docConfig: SiteIndexingConfig;
}

function DocsIndexingStatus({ docConfig }: IndexingStatusViewerProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const { selectedProfile } = useAuth();
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

  if (hasDeleted) return null;

  return (
    <div className="mt-2 flex w-full flex-col">
      <div
        className={`flex flex-row items-center justify-between gap-2 text-sm`}
      >
        <div
          className={`flex flex-row items-center gap-1 ${status?.url ? "cursor-pointer hover:underline" : ""}`}
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
              className="h-3 w-3"
            />
          ) : null}
          <p
            style={{
              fontSize: `${getFontSize() - 3}px`,
            }}
            className="lines lines-1 m-0 p-0 text-left"
          >
            {docConfig.title ?? docConfig.startUrl}
          </p>
          <ArrowTopRightOnSquareIcon className="h-2 w-2 text-gray-400" />
        </div>

        <div className="flex flex-row items-center gap-2">
          <div className="flex flex-row items-center gap-1 text-gray-400">
            {status?.status === "indexing" && (
              <span
                className="text-xs"
                style={{
                  fontSize: `${getFontSize() - 3}px`,
                }}
              >
                {progressPercentage}%
              </span>
            )}

            {status?.status === "indexing" && (
              <StopIcon
                className="h-3 w-3 cursor-pointer text-gray-400 hover:brightness-125"
                onClick={abort}
              />
            )}

            {["aborted", "complete", "failed"].includes(
              status?.status ?? "",
            ) && (
              <ArrowPathIcon
                className="h-3 w-3 cursor-pointer text-gray-400 hover:brightness-125"
                onClick={reIndex}
              />
            )}

            {/* Commenting out until we have ability to edit local YAML for the user to remove the docs  */}
            {/* {selectedProfile?.profileType === "local" &&
            status?.status !== "indexing" ? (
              <TrashIcon
                className="h-3 w-3 cursor-pointer text-gray-400 hover:brightness-125"
                onClick={onDelete}
              />
            ) : null} */}

            <StatusIndicator status={status?.status} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocsIndexingStatus;
