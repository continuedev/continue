import { parseConfigYaml } from "@continuedev/config-yaml";
import { PlusIcon } from "@heroicons/react/24/outline";
import { IndexingStatus } from "core";
import { useContext, useMemo } from "react";
import { useDispatch } from "react-redux";
import { useAuth } from "../../../../../context/Auth";
import { IdeMessengerContext } from "../../../../../context/IdeMessenger";
import { useAppSelector } from "../../../../../redux/hooks";
import {
  setDialogMessage,
  setShowDialog,
} from "../../../../../redux/slices/uiSlice";
import { fontSize } from "../../../../../util";
import AddDocsDialog from "../../../../dialogs/AddDocsDialog";
import DocsIndexingStatus from "./DocsIndexingStatus";

function DocsIndexingStatuses() {
  const dispatch = useDispatch();
  const config = useAppSelector((store) => store.config.config);
  const indexingStatuses = useAppSelector(
    (store) => store.indexing.indexing.statuses,
  );
  const { selectedProfile } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);

  const mergedDocs = useMemo(() => {
    const parsed = selectedProfile?.rawYaml
      ? parseConfigYaml(selectedProfile?.rawYaml ?? "")
      : undefined;
    return (config.docs ?? []).map((doc, index) => ({
      doc,
      docFromYaml: parsed?.docs?.[index],
    }));
  }, [config.docs, selectedProfile?.rawYaml]);

  const handleAddDocs = () => {
    if (selectedProfile?.profileType === "local") {
      dispatch(setShowDialog(true));
      dispatch(setDialogMessage(<AddDocsDialog />));
    } else {
      ideMessenger.request("controlPlane/openUrl", {
        path: "new?type=block&blockType=docs",
        orgSlug: undefined,
      });
    }
  };

  const sortedConfigDocs = useMemo(() => {
    const sorter = (status: IndexingStatus["status"]) => {
      if (status === "complete") return 0;
      if (status === "indexing" || status === "paused") return 1;
      if (status === "failed") return 2;
      if (status === "aborted" || status === "pending") return 3;
      return 4;
    };

    const docs = [...mergedDocs];
    docs.sort((a, b) => {
      const statusA = indexingStatuses[a.doc.startUrl]?.status ?? "pending";
      const statusB = indexingStatuses[b.doc.startUrl]?.status ?? "pending";

      // First, compare by status
      const statusCompare = sorter(statusA) - sorter(statusB);
      if (statusCompare !== 0) return statusCompare;

      // If status is the same, sort by presence of icon
      const hasIconA = !!a.doc.faviconUrl;
      const hasIconB = !!b.doc.faviconUrl;
      return hasIconB === hasIconA ? 0 : hasIconB ? 1 : -1;
    });
    return docs;
  }, [mergedDocs, indexingStatuses]);

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
        {sortedConfigDocs.map((docConfig) => {
          return (
            <div
              key={docConfig.doc.startUrl}
              className="flex items-center gap-2"
            >
              <div className="flex-grow">
                <DocsIndexingStatus
                  docFromYaml={docConfig.docFromYaml}
                  docConfig={docConfig.doc}
                />
              </div>
            </div>
          );
        })}
      </div>
      {sortedConfigDocs.length > 0 && (
        <div
          className="cursor-pointer rounded px-2 pb-1 text-center text-gray-400 hover:text-gray-300"
          style={{
            fontSize: fontSize(-3),
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
