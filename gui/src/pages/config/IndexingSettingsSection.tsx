import { useAppSelector } from "../../redux/hooks";
import IndexingProgress from "./IndexingProgress";

export function IndexingSettingsSection() {
  const config = useAppSelector((state) => state.config.config);
  return (
    <div className="py-5">
      <div>
        <h3 className="mx-auto mb-1 mt-0 text-xl">@codebase index</h3>
        <span className="text-lightgray w-3/4 text-xs">
          Local embeddings of your codebase
        </span>
      </div>
      {config.disableIndexing ? (
        <div className="pb-2 pt-5">
          <p className="py-1 text-center font-semibold">Indexing is disabled</p>
          <p className="text-lightgray cursor-pointer text-center text-xs">
            Open settings and toggle <code>Enable Indexing</code> to re-enable
          </p>
        </div>
      ) : (
        <IndexingProgress />
      )}
    </div>
  );
}
