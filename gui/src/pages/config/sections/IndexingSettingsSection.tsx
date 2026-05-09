import {
  SharedConfigSchema,
  modifyAnyConfigWithSharedConfig,
} from "core/config/sharedConfig";
import { useContext } from "react";
import Alert from "../../../components/gui/Alert";
import { Divider } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { updateConfig } from "../../../redux/slices/configSlice";
import { selectCurrentOrg } from "../../../redux/slices/profilesSlice";
import { ConfigHeader } from "../components/ConfigHeader";
import { SettingsPanel } from "../components/SettingsPanel";
import { UserSetting } from "../components/UserSetting";
import IndexingProgress from "../features/indexing";
import { DocsSection } from "./DocsSection";

function CodebaseSubSection() {
  const config = useAppSelector((state) => state.config.config);

  return (
    <SettingsPanel
      anchorId="codebase-index"
      title="@codebase index"
      description="Monitor the legacy codebase index while it remains available in this workspace."
    >
      <div className="px-4 py-4">
        {config.disableIndexing ? (
          <div className="p-1">
            <p className="text-center font-semibold">Indexing is disabled</p>
          </div>
        ) : (
          <IndexingProgress />
        )}
      </div>
    </SettingsPanel>
  );
}

function EnableIndexingSetting() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((state) => state.config.config);
  const currentOrg = useAppSelector(selectCurrentOrg);

  function handleUpdate(sharedConfig: SharedConfigSchema) {
    const updatedConfig = modifyAnyConfigWithSharedConfig(config, sharedConfig);
    dispatch(updateConfig(updatedConfig));
    ideMessenger.post("config/updateSharedConfig", sharedConfig);
  }

  const disableIndexing = config.disableIndexing ?? false;
  const disableIndexingToggle =
    currentOrg?.policy?.allowCodebaseIndexing === false;

  return (
    <div className="flex flex-col gap-4">
      <UserSetting
        title="Enable indexing"
        type="toggle"
        description={
          <div className="text-foreground">
            Allows indexing of your codebase for search and context
            understanding.
            <br />
            <br />
            Note that indexing can consume significant system resources,
            especially on larger codebases.
          </div>
        }
        value={!disableIndexing}
        disabled={disableIndexingToggle}
        onChange={(value) => handleUpdate({ disableIndexing: !value })}
      />
    </div>
  );
}

export function IndexingSettingsSection() {
  const config = useAppSelector((state) => state.config.config);
  const disableIndexing = config.disableIndexing ?? false;

  return (
    <>
      <ConfigHeader
        title="Indexing & Docs"
        subtext="Review the deprecated indexing flow and any remaining documentation retrieval settings."
      />

      <div
        data-config-anchor="indexing-overview"
        data-testid="config-anchor-indexing-overview"
      />

      <Alert type="warning" className="mb-6">
        <div className="space-y-4">
          <div>
            <div className="-mt-0.5 text-sm font-medium">
              Indexing has been deprecated
            </div>
            <div className="mt-1 text-xs">
              Learn how to{" "}
              <a
                href="https://docs.yutoagentic.dev/guides/codebase-documentation-awareness"
                target="_blank"
                rel="noopener noreferrer"
                className="text-inherit underline hover:brightness-125"
              >
                make your agent aware of your codebase and documentation
              </a>
            </div>
          </div>
          <Divider className="border-inherit" />
          <EnableIndexingSetting />
        </div>
      </Alert>

      {!disableIndexing && (
        <div className="space-y-8">
          <CodebaseSubSection />
          <DocsSection />
        </div>
      )}
    </>
  );
}
