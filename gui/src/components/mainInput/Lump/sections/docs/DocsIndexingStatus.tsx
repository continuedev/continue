import { ConfigYaml } from "@continuedev/config-yaml";
import {
  ArrowPathIcon,
  PencilIcon,
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
import { fontSize } from "../../../../../util";
import ConfirmationDialog from "../../../../dialogs/ConfirmationDialog";
import { StatusIndicator } from "./StatusIndicator";
interface IndexingStatusViewerProps {
  docConfig: SiteIndexingConfig;
  docFromYaml?: NonNullable<ConfigYaml["docs"]>[number];
}

function isUsesBlock(block: any): block is { uses: string } {
  return typeof block !== "string" && "uses" in block;
}

function DocsIndexingStatus({
  docConfig,
  docFromYaml,
}: IndexingStatusViewerProps) {
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

  const openUrl = (path: string) =>
    ideMessenger.request("controlPlane/openUrl", {
      path,
      orgSlug: undefined,
    });

  const handleEdit = () => {
    console.log("edit", docFromYaml);
    if (selectedProfile?.profileType === "local") {
      ideMessenger.post("config/openProfile", {
        profileId: undefined,
      });
    } else if (docFromYaml && isUsesBlock(docFromYaml)) {
      openUrl(`${docFromYaml.uses}/new-version`);
    } else if (selectedProfile?.fullSlug) {
      const slug = `${selectedProfile.fullSlug.ownerSlug}/${selectedProfile.fullSlug.packageSlug}`;
      openUrl(`${slug}/new-version`);
    }
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
          className={`flex flex-row items-center gap-1`}
          onClick={() => {
            if (status?.url) {
              ideMessenger.post("openUrl", status.url);
            }
          }}
        >
          <StatusIndicator
            status={status?.status}
            hoverMessage={
              status?.status === "failed" ? status?.debugInfo : undefined
            }
          />
          {docConfig.faviconUrl ? (
            <img
              src={docConfig.faviconUrl}
              alt="doc icon"
              className="h-3 w-3"
            />
          ) : null}
          <p
            style={{
              fontSize: fontSize(-3),
            }}
            className={`lines lines-1 m-0 p-0 text-left ${status?.url ? "cursor-pointer hover:underline" : ""}`}
          >
            {docConfig.title ?? docConfig.startUrl}
          </p>
        </div>

        <div className="flex flex-row items-center gap-2">
          <div className="flex flex-row items-center gap-1 text-gray-400">
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

            <PencilIcon
              className="h-3 w-3 cursor-pointer text-gray-400 hover:brightness-125"
              onClick={handleEdit}
            />

            {/* Removed StatusIndicator from here */}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocsIndexingStatus;
