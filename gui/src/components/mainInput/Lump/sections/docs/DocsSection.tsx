import { parseConfigYaml } from "@continuedev/config-yaml";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { useMemo, useState } from "react";
import { useAuth } from "../../../../../context/Auth";
import { useAppSelector } from "../../../../../redux/hooks";
import { ExploreBlocksButton } from "../ExploreBlocksButton";
import DocsIndexingStatus from "./DocsIndexingStatus";

function DocsIndexingStatuses() {
  const [searchTerm, setSearchTerm] = useState("");
  const config = useAppSelector((store) => store.config.config);
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

  const filteredAndSortedDocs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    // Filter docs based on search term
    const filtered =
      term === ""
        ? mergedDocs
        : mergedDocs.filter(({ doc }) => {
            const title = (doc.title || "").toLowerCase();
            const url = (doc.startUrl || "").toLowerCase();
            return title.includes(term) || url.includes(term);
          });

    // Sort alphabetically by title (or URL if no title)
    const sorted = [...filtered].sort((a, b) => {
      const aName = (a.doc.title || a.doc.startUrl || "").toLowerCase();
      const bName = (b.doc.title || b.doc.startUrl || "").toLowerCase();
      return aName.localeCompare(bName);
    });

    return sorted;
  }, [mergedDocs, searchTerm]);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative my-2">
        <input
          className="bg-vsc-input-background text-vsc-foreground w-full rounded-md border border-none py-1 pl-2 pr-8 text-sm outline-none"
          placeholder="Search docs by name or URL"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <XMarkIcon
            className="text-vsc-foreground hover:bg-vsc-background duration-50 absolute right-2 top-1/2 h-5 w-5 -translate-y-1/2 transform cursor-pointer rounded-full p-0.5 transition-colors"
            onClick={() => setSearchTerm("")}
          />
        )}
      </div>
      <div className="flex flex-col overflow-y-auto overflow-x-hidden pr-2">
        {filteredAndSortedDocs.map((docConfig) => {
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
      <ExploreBlocksButton blockType="docs" />
    </div>
  );
}

export default DocsIndexingStatuses;
