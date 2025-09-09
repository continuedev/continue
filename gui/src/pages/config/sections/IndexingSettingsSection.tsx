import {
  SharedConfigSchema,
  modifyAnyConfigWithSharedConfig,
} from "core/config/sharedConfig";
import { useContext } from "react";
import Alert from "../../../components/gui/Alert";
import { Card } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { updateConfig } from "../../../redux/slices/configSlice";
import { selectCurrentOrg } from "../../../redux/slices/profilesSlice";
import { ConfigHeader } from "../components/ConfigHeader";
import { UserSetting } from "../components/UserSetting";
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
    <Card>
      <div className="flex flex-col gap-4">
        <UserSetting
          title="Enable indexing"
          type="toggle"
          description={
            <>
              Allows indexing of your codebase for search and context
              understanding.
              <br />
              <br />
              Note that indexing can consume significant system resources,
              especially on larger codebases.
            </>
          }
          value={!disableIndexing}
          disabled={disableIndexingToggle}
          onChange={(value) => handleUpdate({ disableIndexing: !value })}
        />
      </div>
    </Card>
  );
}

export function IndexingSettingsSection() {
  const config = useAppSelector((state) => state.config.config);
  const disableIndexing = config.disableIndexing ?? false;

  return (
    <>
      <ConfigHeader title="Indexing" />

      <Alert type="warning" className="mb-6">
        <div>
          <div className="text-sm font-medium">
            Indexing has been deprecated
          </div>
          <div className="mt-1">
            Learn more about{" "}
            <a
              href="https://docs.continue.dev/guides/codebase-documentation-awareness"
              target="_blank"
              rel="noopener noreferrer"
              className="text-inherit underline hover:brightness-125"
            >
              making your agent aware of your codebase and documentation
            </a>
          </div>
        </div>
      </Alert>

      <div className="mb-6">
        <EnableIndexingSetting />
      </div>

      <div className={`space-y-8 ${disableIndexing ? "opacity-50" : ""}`}>
        <CodebaseSubSection />
        <DocsSection />
      </div>
    </>
  );
}
