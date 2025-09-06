import DocsIndexingStatuses from "../../../components/mainInput/Lump/sections/docs/DocsSection";
import { Card } from "../../../components/ui";
import { useAppSelector } from "../../../redux/hooks";
import { ConfigHeader } from "../ConfigHeader";
import IndexingProgress from "../features/indexing";

export function IndexingSettingsSection() {
  const config = useAppSelector((state) => state.config.config);
  return (
    <div className="flex flex-col gap-4 py-5">
      <ConfigHeader
        title="Indexing"
        subtext="Manage your codebase and documentation indexing"
      />

      <Card>
        <div className="flex flex-col gap-6">
          <div>
            <h4 className="mb-2 text-base font-medium">@codebase index</h4>
            <span className="text-lightgray mb-3 block text-xs">
              Local embeddings of your codebase
            </span>
            {config.disableIndexing ? (
              <div className="pb-2 pt-2">
                <p className="py-1 text-center font-semibold">
                  Indexing is disabled
                </p>
                <p className="text-lightgray cursor-pointer text-center text-xs">
                  Open settings and toggle <code>Enable Indexing</code> to
                  re-enable
                </p>
              </div>
            ) : (
              <IndexingProgress />
            )}
          </div>

          <div>
            <h4 className="mb-2 text-base font-medium">@docs index</h4>
            <span className="text-lightgray mb-3 block text-xs">
              Local embeddings of your documentation sources
            </span>
            <DocsIndexingStatuses />
          </div>
        </div>
      </Card>
    </div>
  );
}
