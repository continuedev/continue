import { parseConfigYaml } from "@continuedev/config-yaml";
import { IndexingStatus } from "core";
import { useMemo } from "react";
import { useAuth } from "../../../../context/Auth";
import { useAppSelector } from "../../../../redux/hooks";
import { EmptyState } from "../../../../components/ui";
import DocsIndexingStatus from "./DocsIndexingStatus";

function DocsIndexingStatuses() {
  const config = useAppSelector((store) => store.config.config);
  const indexingStatuses = useAppSelector(
    (store) => store.indexing.indexing.statuses,
  );
  const { selectedProfile } = useAuth();
  const mergedDocs = useMemo(() => {
    const parsed = selectedProfile?.rawYaml
      ? parseConfigYaml(selectedProfile?.rawYaml ?? "")
      : undefined;
    return (config.docs ?? []).map((doc, index) => ({
      doc,
      docFromYaml: parsed?.docs?.[index],
    }));
  }, [config.docs, selectedProfile?.rawYaml]);

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

  if (sortedConfigDocs.length === 0) {
    return (
      <EmptyState message="No documentation sources configured. Click the + button to add your first docs." />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col overflow-y-auto overflow-x-hidden pr-2">
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
    </div>
  );
}

export default DocsIndexingStatuses;
