import { parseConfigYaml } from "@continuedev/config-yaml";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { IndexingStatus } from "core";
import { useMemo, useState, useEffect } from "react";
import { useAuth } from "../../../../../context/Auth";
import { useAppSelector } from "../../../../../redux/hooks";
import { ExploreBlocksButton } from "../ExploreBlocksButton";
import DocsIndexingStatus from "./DocsIndexingStatus";
import { Input } from "../../../../Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../Select";

type SortOption = "status" | "name" | "url";
type GroupOption = "none" | "domain" | "category";

interface CollapsibleGroupProps {
  title: string;
  count: number;
  isExpanded: boolean;
  onToggle: () = void;
  children: React.ReactNode;
}

const CollapsibleGroup: React.FCCollapsibleGroupProps = ({ 
  title, 
  count, 
  isExpanded, 
  onToggle, 
  children 
}) = {
  return (
    div className="mb-2"
      button
        onClick={onToggle}
        className="flex items-center gap-1 w-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
      
        {isExpanded ? (
          ChevronDownIcon className="h-4 w-4" /
        ) : (
          ChevronRightIcon className="h-4 w-4" /
        )}
        span className="font-medium text-sm"{title}/span
        span className="text-xs text-gray-500 ml-1"({count})/span
      /button
      {isExpanded  (
        div className="ml-4"
          {children}
        /div
      )}
    /div
  );
};

function DocsIndexingStatuses() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useStateSortOption("status");
  const [groupBy, setGroupBy] = useStateGroupOption("none");
  const [expandedGroups, setExpandedGroups] = useStateSetstring(new Set());
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  // Debounce search query
  useEffect(() = {
    const timer = setTimeout(() = {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () = clearTimeout(timer);
  }, [searchQuery]);

  const config = useAppSelector((store) = store.config.config);
  const indexingStatuses = useAppSelector(
    (store) = store.indexing.indexing.statuses,
  );
  const { selectedProfile } = useAuth();
  const mergedDocs = useMemo(() = {
    const parsed = selectedProfile?.rawYaml
      ? parseConfigYaml(selectedProfile?.rawYaml ?? "")
      : undefined;
    return (config.docs ?? []).map((doc, index) = ({
      doc,
      docFromYaml: parsed?.docs?.[index],
    }));
  }, [config.docs, selectedProfile?.rawYaml]);

  // Filter docs based on search query
  const filteredDocs = useMemo(() = {
    const allDocs = (mergedDocs ?? []);
    if (!debouncedSearchQuery) return allDocs;
    
    const query = debouncedSearchQuery.toLowerCase();
    return allDocs.filter(
      ({ doc }) =
        doc.title?.toLowerCase().includes(query) ||
        doc.startUrl?.toLowerCase().includes(query)
    );
  }, [mergedDocs, debouncedSearchQuery]);

  // Sort docs
  const sortedConfigDocs = useMemo(() = {
    const sorted = [...filteredDocs];
    switch (sortBy) {
      case "status":
        const statusOrder = { indexing: 0, failed: 1, complete: 2, pending: 3, aborted: 4 };
        sorted.sort((a, b) = {
          const orderA = statusOrder[indexingStatuses[a.doc.startUrl]?.status ?? "pending"] ?? 5;
          const orderB = statusOrder[indexingStatuses[b.doc.startUrl]?.status ?? "pending"] ?? 5;
          return orderA - orderB;
        });
        break;
      case "name":
        sorted.sort((a, b) = (a.doc.title || "").localeCompare(b.doc.title || ""));
        break;
      case "url":
        sorted.sort((a, b) = (a.doc.startUrl || "").localeCompare(b.doc.startUrl || ""));
        break;
    }
    return sorted;
  }, [filteredDocs, sortBy, indexingStatuses]);

  // Helper function to categorize docs
  const categorizeDoc = (doc: string): string = {
    const url = doc.toLowerCase() || "";
    if (url.includes("github.com")) return "GitHub";
    if (url.includes("/docs") || url.includes("documentation")) return "Documentation";
    if (url.includes("/api") || url.includes("reference")) return "API Reference";
    if (url.includes("blog") || url.includes("article")) return "Blogs";
    if (url.includes("tutorial") || url.includes("guide")) return "Tutorials  Guides";
    return "Other";
  };

  // Group docs
  const groupedConfigDocs = useMemo(() = {
    if (groupBy === "none") {
      return { "All Documents": sortedConfigDocs };
    }

    const groups: Recordstring, { doc: any, docFromYaml: any }[] = {};
    
    sortedConfigDocs.forEach((docConfig) = {
      let groupKey: string;
      
      if (groupBy === "domain") {
        try {
          const url = new URL(docConfig.doc.startUrl || "");
          groupKey = url.hostname;
        } catch {
          groupKey = "Unknown Domain";
        }
      } else {
        // groupBy === "category"
        groupKey = categorizeDoc(docConfig.doc.startUrl);
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(docConfig);
    });

    // Sort groups by number of docs (descending)
    const sortedGroups: Recordstring, { doc: any, docFromYaml: any }[] = {};
    Object.entries(groups)
      .sort(([, a], [, b]) = b.length - a.length)
      .forEach(([key, value]) = {
        sortedGroups[key] = value;
      });

    return sortedGroups;
  }, [sortedConfigDocs, groupBy]);

  const toggleGroup = (groupName: string) = {
    setExpandedGroups((prev) = {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  // Auto-expand groups when there's only one group or when searching
  useEffect(() = {
    const groupNames = Object.keys(groupedConfigDocs);
    if (groupNames.length === 1 || debouncedSearchQuery) {
      setExpandedGroups(new Set(groupNames));
    }
  }, [groupedConfigDocs, debouncedSearchQuery]);

  const totalDocs = filteredDocs.length;
  const isEmpty = totalDocs === 0  debouncedSearchQuery;

  return (
    div className="space-y-4 overflow-y-auto"
      {/* Search and Filter Controls */}
      div className="sticky top-0 bg-white dark:bg-gray-900 z-10 pb-2 space-y-2"
        Input
          type="text"
          placeholder="Search documentation..."
          value={searchQuery}
          onChange={(e) = setSearchQuery(e.target.value)}
          className="w-full"
        /
        
        div className="flex gap-2"
          Select value={sortBy} onValueChange={(value) = setSortBy(value as SortOption)}
            SelectTrigger className="flex-1"
              SelectValue placeholder="Sort by" /
            /SelectTrigger
            SelectContent
              SelectItem value="status"Status/SelectItem
              SelectItem value="name"Name/SelectItem
              SelectItem value="url"URL/SelectItem
            /SelectContent
          /Select
          
          Select value={groupBy} onValueChange={(value) = setGroupBy(value as GroupOption)}
            SelectTrigger className="flex-1"
              SelectValue placeholder="Group by" /
            /SelectTrigger
            SelectContent
              SelectItem value="none"No Grouping/SelectItem
              SelectItem value="domain"Domain/SelectItem
              SelectItem value="category"Category/SelectItem
            /SelectContent
          /Select
        /div
        
        {searchQuery  (
          button
            onClick={() = setSearchQuery("")}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
          
            Clear search
          /button
        )}
      /div

      {/* Results */}
      {isEmpty ? (
        div className="text-center py-8 text-gray-500"
          pNo documentation found matching "{debouncedSearchQuery}"/p
          button
            onClick={() = setSearchQuery("")}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
          
            Clear search
          /button
        /div
      ) : (
        div
          {Object.entries(groupedConfigDocs).map(([groupName, docs]) = {
            const isExpanded = expandedGroups.has(groupName);
            const showGroup = groupBy !== "none";
            
            if (showGroup) {
              return (
                CollapsibleGroup
                  key={groupName}
                  title={groupName}
                  count={docs.length}
                  isExpanded={isExpanded}
                  onToggle={() = toggleGroup(groupName)}
                
                  {docs.map(({doc, docFromYaml}) = (
                    div key={doc.startUrl} className="flex items-center gap-2"
                      div className="flex-grow"
                        DocsIndexingStatus
                          docFromYaml={docFromYaml}
                          docConfig={doc}
                        /
                      /div
                    /div
                  ))}
                /CollapsibleGroup
              );
            } else {
              return docs.map(({doc, docFromYaml}) = (
                div key={doc.startUrl} className="flex items-center gap-2"
                  div className="flex-grow"
                    DocsIndexingStatus
                      docFromYaml={docFromYaml}
                      docConfig={doc}
                    /
                  /div
                /div
              ));
            }
          })}
        /div
      )}
      ExploreBlocksButton blockType="docs" /
    /div
  );
}

export default DocsIndexingStatuses;
