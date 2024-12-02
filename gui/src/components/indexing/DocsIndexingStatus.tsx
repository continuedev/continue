import { IndexingStatus, SiteIndexingConfig } from "core";
import { useContext, useMemo } from "react";
import { useDispatch } from "react-redux";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  PauseCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useAppSelector } from "../../redux/hooks";
import { updateIndexingStatus } from "../../redux/slices/indexingSlice";

interface IndexingStatusViewerProps {
  docConfig: SiteIndexingConfig;
}

const STATUS_TO_ICON: Record<IndexingStatus["status"], any> = {
  indexing: ArrowPathIcon,
  paused: PauseCircleIcon,
  complete: CheckCircleIcon,
  aborted: null,
  deleted: null,
  pending: null,
  failed: XMarkIcon, // Since we show an erorr message below
};

function DocsIndexingStatus({ docConfig }: IndexingStatusViewerProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useDispatch();

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

  const progressPercentage = useMemo(() => {
    if (!status) {
      return 0;
    }
    return Math.min(100, Math.max(0, status.progress * 100));
  }, [status?.progress]);

  const Icon = STATUS_TO_ICON[status?.status];

  return (
    <div className="mt-2 flex w-full flex-col">
      {/* {`${status.type} - ${status.id} - ${status.status} - ${status.progress} - ${status.description} - ${status.icon}`} */}
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
            <span className="text-xs">{progressPercentage.toFixed(0)}%</span>
            {Icon ? (
              <Icon
                className={`inline-block h-4 w-4 text-stone-500 ${
                  status?.status === "indexing" ? "animate-spin-slow" : ""
                }`}
              ></Icon>
            ) : null}
          </div>
        )}
      </div>

      <div className="my-2 h-1.5 w-full rounded-md border border-solid border-gray-400">
        <div
          className={`h-full rounded-lg transition-all duration-200 ease-in-out ${
            status?.status === "failed" ? "bg-red-600" : "bg-stone-500"
          }`}
          style={{
            width: `${progressPercentage}%`,
          }}
        />
      </div>

      <div className="flex flex-row items-center justify-between gap-4">
        <span
          className={`cursor-pointer whitespace-nowrap text-xs text-stone-500 underline`}
          onClick={
            {
              complete: reIndex,
              indexing: abort,
              failed: reIndex,
              aborted: reIndex,
              paused: () => {},
              deleted: () => {},
              pending: () => {},
            }[status?.status]
          }
        >
          {
            {
              complete: "Click to re-index",
              indexing: "Cancel indexing",
              failed: "Click to retry",
              aborted: "Click to index",
              paused: "",
              deleted: "",
              pending: "",
            }[status?.status]
          }
        </span>

        <span className="lines lines-1 text-right text-xs text-stone-500">
          {status?.description}
        </span>
      </div>
    </div>
  );
}

export default DocsIndexingStatus;
