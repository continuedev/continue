"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { create, load, search, type AnyOrama } from "@orama/orama";

interface SearchResult {
  title: string;
  path: string;
  content: string;
  section: string;
}

export function DocsSearch({ resolve }: { resolve: (path: string) => string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [allDocs, setAllDocs] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const dbRef = useRef<AnyOrama | null>(null);
  const router = useRouter();

  // Cmd+K keyboard shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open || dbRef.current) return;
    setLoading(true);
    fetch("/search-index.json")
      .then((res) => res.json())
      .then((data) => {
        const db = create({
          schema: {
            title: "string" as const,
            path: "string" as const,
            content: "string" as const,
            section: "string" as const,
          },
        });
        load(db, data);
        dbRef.current = db;
        // Get all docs for showing when query is empty
        const allResult = search(db, { term: "", limit: 100 });
        const toResults = (r: typeof allResult) =>
          (r as Awaited<typeof allResult>).hits.map(
            (hit: { document: unknown }) => hit.document as SearchResult,
          );
        setAllDocs(toResults(allResult));
      })
      .finally(() => setLoading(false));
  }, [open]);

  // Search when query changes
  useEffect(() => {
    if (!dbRef.current || !query.trim()) {
      setResults([]);
      return;
    }
    const res = search(dbRef.current, {
      term: query,
      limit: 10,
      tolerance: 1,
      boost: { title: 3, section: 1.5 },
    }) as Awaited<ReturnType<typeof search>>;
    setResults(
      res.hits.map(
        (hit: { document: unknown }) => hit.document as SearchResult,
      ),
    );
  }, [query]);

  const displayResults = query.trim() ? results : allDocs;

  function handleSelect(path: string) {
    setOpen(false);
    setQuery("");
    router.push(resolve(`/docs/${path}`));
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-black/10 bg-black/[0.02] px-3 text-[13px] text-black/40 transition-colors hover:border-black/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/40 dark:hover:border-white/20"
      >
        <Search className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="hidden h-5 items-center gap-0.5 rounded border border-black/10 bg-black/[0.03] px-1.5 font-mono text-[10px] text-black/40 sm:inline-flex dark:border-white/10 dark:bg-white/[0.06] dark:text-white/40">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        dialogClassName="top-[15%] translate-y-0 data-[state=closed]:slide-out-to-top-[10%] data-[state=open]:slide-in-from-top-[10%]"
      >
        <CommandInput
          placeholder="Search documentation..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[400px]">
          {loading ? (
            <div className="text-muted-foreground py-6 text-center text-sm">
              Loading search index...
            </div>
          ) : (
            <>
              <CommandEmpty>No results found.</CommandEmpty>
              {displayResults.length > 0 && (
                <CommandGroup heading={query.trim() ? "Results" : "All pages"}>
                  {displayResults.map((result) => (
                    <CommandItem
                      key={result.path}
                      value={result.path}
                      onSelect={() => handleSelect(result.path)}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{result.title}</span>
                        <span className="text-muted-foreground line-clamp-1 text-xs">
                          {result.content.slice(0, 120)}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
