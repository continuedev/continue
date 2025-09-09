import { MinusCircleIcon, PlusCircleIcon } from "@heroicons/react/24/outline";
import { useContext, useEffect, useState } from "react";
import DocsIndexingStatuses from "../../components/mainInput/Lump/sections/docs/DocsSection";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppSelector } from "../../redux/hooks";
import IndexingProgress from "./IndexingProgress";

export function IndexingSettingsSection() {
  const config = useAppSelector((state) => state.config.config);
  const ideMessenger = useContext(IdeMessengerContext);
  const [numConcurrent, setNumConcurrent] = useState(3);

  const handleUpdate = async (num: number) => {
    await ideMessenger.request("docs/updateMaxNumberOfConcurrentIndexing", num);
    const res = await ideMessenger.request(
      "docs/getMaxNumberOfConcurrentIndexing",
      undefined,
    );
    if (res.status === "success") {
      setNumConcurrent(res.content);
    }
  };

  const minusOne = async () => {
    if (numConcurrent > 1) {
      handleUpdate(numConcurrent - 1);
    }
  };

  const plusOne = async () => {
    if (numConcurrent < 50) {
      handleUpdate(numConcurrent + 1);
    }
  };

  useEffect(() => {
    const syncMaxNumberOfConcurrentIndexing = async () => {
      const res = await ideMessenger.request(
        "docs/getMaxNumberOfConcurrentIndexing",
        undefined,
      );

      if (res.status === "success") {
        setNumConcurrent(res.content);
      }
    };

    syncMaxNumberOfConcurrentIndexing();
  }, []);

  return (
    <div className="flex flex-col gap-3 py-5">
      <div>
        <h3 className="mx-auto mb-1 mt-0 text-xl">@codebase index</h3>
        <span className="text-lightgray w-3/4 text-xs">
          Local embeddings of your codebase
        </span>
        {config.disableIndexing ? (
          <div className="pb-2 pt-5">
            <p className="py-1 text-center font-semibold">
              Indexing is disabled
            </p>
            <p className="text-lightgray cursor-pointer text-center text-xs">
              Open settings and toggle <code>Enable Indexing</code> to re-enable
            </p>
          </div>
        ) : (
          <IndexingProgress />
        )}
      </div>

      <div className="mt-5">
        <h3 className="mx-auto mb-1 mt-0 text-xl">@docs index</h3>
        <span className="text-lightgray w-3/4 text-xs">
          Local embeddings of your documentation sources
        </span>
        <label className="flex min-h-14 items-center justify-between gap-3">
          <span className="text-left text-sm">
            Number of Concurrent Indexing
          </span>

          <div className="text-vsc-foreground flex min-w-8 items-center border-none bg-inherit pr-1.5 text-right outline-none ring-0 focus:border-none focus:outline-none focus:ring-0">
            <MinusCircleIcon
              onClick={minusOne}
              className="h-4 w-4 cursor-pointer pr-1 text-gray-400 hover:brightness-125"
            />
            <span>{numConcurrent}</span>
            <PlusCircleIcon
              onClick={plusOne}
              className="h-4 w-4 cursor-pointer pl-1 text-gray-400 hover:brightness-125"
            />
          </div>
        </label>
      </div>
      <DocsIndexingStatuses />
    </div>
  );
}
