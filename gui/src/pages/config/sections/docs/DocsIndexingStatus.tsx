import { ConfigYaml } from "@continuedev/config-yaml";
import {
  ArrowPathIcon,
  PencilIcon,
  StopIcon,
} from "@heroicons/react/24/outline";
import { SiteIndexingConfig } from "core";
import { useContext, useEffect, useMemo, useState } from "react";
import ConfirmationDialog from "../../../../components/dialogs/ConfirmationDialog";
import { ToolTip } from "../../../../components/gui/Tooltip";
import { useEditDoc } from "../../../../components/mainInput/Lump/useEditBlock";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../../redux/hooks";
import { updateIndexingStatus } from "../../../../redux/slices/indexingSlice";
import {
  setDialogMessage,
  setShowDialog,
} from "../../../../redux/slices/uiSlice";
import { fontSize } from "../../../../util";
import { IndexedPagesTooltip } from "./IndexedPagesTooltip";
import { StatusIndicator } from "./StatusIndicator";

interface IndexingStatusViewerProps {
  docConfig: SiteIndexingConfig;
  docFromYaml?: NonNullable<ConfigYaml["docs"]>[number];
}

function DocsIndexingStatus({
  docConfig,
  docFromYaml,
}: IndexingStatusViewerProps) {
  const editDoc = useEditDoc();
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();
  const [indexedPages, setIndexedPages] = useState<null | string[]>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  const status = useAppSelector(
    (store) => store.indexing.indexing.statuses[docConfig.startUrl],
  );

  const isComplete = status?.status === "complete";

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

  // Fetch pages list when the status changes to complete
  useEffect(() => {
    async function getPagesList() {
      try {
        const response = await ideMessenger.request("docs/getIndexedPages", {
          startUrl: docConfig.startUrl,
        });
        if (response.status === "error") {
          throw new Error(response.error);
        }
        setIndexedPages(response.content.sort());
      } catch (ex) {
        console.error(
          `Unable to fetch pages list for ${docConfig.startUrl}: ${ex}`,
        );
      }
    }

    if (isComplete) {
      void getPagesList();
    }
  }, [isComplete, ideMessenger, docConfig.startUrl]);

  const showPagesList = () => {
    if (indexedPages) {
      setShowTooltip(true);
    }
  };

  if (hasDeleted) return null;

  const startUrlSlug = docConfig.startUrl.replace(/[^a-zA-Z0-9_-]/g, "_");

  return (
    <div className="mt-1 flex w-full flex-col">
      <div
        className={`flex flex-row items-center justify-between gap-2 text-sm`}
      >
        <div
          className={`flex flex-row items-center gap-1`}
          onClick={() => {
            if (status?.url) {
              ideMessenger.post("openUrl", status.url);
            }
          }}
        >
          <p
            style={{
              fontSize: fontSize(-3),
            }}
            className={`m-0 line-clamp-1 p-0 text-left ${status?.url ? "cursor-pointer hover:underline" : ""}`}
          >
            {docConfig.title ?? docConfig.startUrl}
          </p>
        </div>

        <div className="flex flex-row items-center gap-2">
          <div className="flex flex-row items-center gap-2 text-gray-400">
            {status?.status === "indexing" && (
              <span
                className="text-xs"
                style={{
                  fontSize: fontSize(-3),
                }}
              >
                {progressPercentage}%
              </span>
            )}

            {status?.status === "indexing" && (
              <StopIcon
                className="h-3 w-3 cursor-pointer text-gray-400 hover:brightness-125"
                onClick={abort}
                data-testid="stop-indexing"
              />
            )}

            <PencilIcon
              className={
                "h-3 w-3 cursor-pointer text-gray-400 hover:brightness-125"
              }
              onClick={() => editDoc(docFromYaml)}
            />

            {["aborted", "complete", "failed"].includes(
              status?.status ?? "",
            ) && (
              <ArrowPathIcon
                className="h-3 w-3 cursor-pointer text-gray-400 hover:brightness-125"
                onClick={reIndex}
                data-testid="reindex-docs"
              />
            )}

            <StatusIndicator
              status={status?.status}
              hoverMessage={
                status?.status === "failed" ? status?.debugInfo : undefined
              }
            />
          </div>
        </div>
      </div>

      {status && (
        <div
          className={`flex flex-row items-center justify-between gap-2 text-sm`}
        >
          <p
            style={{
              fontSize: fontSize(-4),
            }}
            className={`m-0 line-clamp-1 p-0 text-left text-gray-400 ${isComplete ? "cursor-pointer hover:underline" : ""}`}
            onClick={() => {
              if (isComplete) {
                showPagesList();
              }
            }}
            data-tooltip-id={`docs-tooltip-${startUrlSlug}`}
          >
            {isComplete
              ? indexedPages
                ? `${indexedPages.length} page${indexedPages.length === 1 ? "" : "s"} indexed`
                : "Loading site info..."
              : status.description}
          </p>
        </div>
      )}

      {indexedPages && (
        <ToolTip
          isOpen={showTooltip}
          setIsOpen={setShowTooltip}
          clickable
          delayShow={0}
          openEvents={{
            mouseenter: false,
            click: true,
          }}
          closeEvents={{
            blur: true,
            mouseleave: false,
            click: true,
          }}
          content={
            <IndexedPagesTooltip
              pages={indexedPages}
              siteTitle={docConfig.title ?? docConfig.startUrl}
              baseUrl={docConfig.startUrl}
            />
          }
        >
          <div data-tooltip-id={`docs-tooltip-${startUrlSlug}`} />
        </ToolTip>
      )}
    </div>
  );
}

export default DocsIndexingStatus;
