import { Card } from "../../../components/ui";
import { useAppSelector } from "../../../redux/hooks";
import IndexingProgress from "../features/indexing";
import { DocsSection } from "./DocsSection";

function CodebaseSubSection() {
  const config = useAppSelector((state) => state.config.config);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="mb-0 text-sm font-semibold">@codebase index</h3>
      </div>

      <Card>
        <div className="py-2">
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
      </Card>
    </div>
  );
}

export function IndexingSettingsSection() {
  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="mb-0 text-xl font-semibold">Indexing</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your codebase and documentation indexing
          </p>
        </div>
      </div>

      <div className="space-y-10">
        <CodebaseSubSection />
        <DocsSection />
      </div>
    </>
  );
}
