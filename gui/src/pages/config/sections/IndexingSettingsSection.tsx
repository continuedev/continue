import {
  SharedConfigSchema,
  modifyAnyConfigWithSharedConfig,
} from "core/config/sharedConfig";
import { useContext } from "react";
import Alert from "../../../components/gui/Alert";
import { Card, Divider } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { updateConfig } from "../../../redux/slices/configSlice";
import { selectCurrentOrg } from "../../../redux/slices/profilesSlice";
import { ConfigHeader } from "../components/ConfigHeader";
import { UserSetting } from "../components/UserSetting";
import IndexingProgress from "../features/indexing";
import { DocsSection } from "./DocsSection";
import i18n from "../../../locales/i18n";

function CodebaseSubSection() {
  const config = useAppSelector((state) => state.config.config);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="mb-0 text-sm font-semibold">
          {i18n.t("IndexingSettingsSection.codebaseIndex")}
        </h3>
      </div>

      <Card>
        <div className="py-2">
          {config.disableIndexing ? (
            <div className="p-1">
              <p className="text-center font-semibold">
                {i18n.t("IndexingSettingsSection.indexingDisabled")}
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
    <div className="flex flex-col gap-4">
      <UserSetting
        title={i18n.t("IndexingSettingsSection.enableIndexing")}
        type="toggle"
        description={
          <div className="text-foreground">
            {i18n.t("IndexingSettingsSection.enableIndexingDescription")}
            <br />
            <br />
            {i18n.t("IndexingSettingsSection.enableIndexingNote")}
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
      <ConfigHeader title={i18n.t("IndexingSettingsSection.indexing")} />

      <Alert type="warning" className="mb-6">
        <div className="space-y-4">
          <div>
            <div className="-mt-0.5 text-sm font-medium">
              {i18n.t("IndexingSettingsSection.indexingDeprecated")}
            </div>
            <div className="mt-1 text-xs">
              {i18n.t("IndexingSettingsSection.learnHowTo")}{" "}
              <a
                href="https://docs.continue.dev/guides/codebase-documentation-awareness"
                target="_blank"
                rel="noopener noreferrer"
                className="text-inherit underline hover:brightness-125"
              >
                {i18n.t("IndexingSettingsSection.makeAgentAware")}
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
