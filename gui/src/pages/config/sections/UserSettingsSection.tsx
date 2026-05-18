import {
  SharedConfigSchema,
  modifyAnyConfigWithSharedConfig,
} from "core/config/sharedConfig";
import { HubSessionInfo } from "core/control-plane/AuthTypes";
import { isContinueTeamMember } from "core/util/isContinueTeamMember";
import { useContext, useEffect, useState } from "react";
import { Card, Toggle, useFontSize } from "../../../components/ui";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { updateConfig } from "../../../redux/slices/configSlice";
import { selectCurrentOrg } from "../../../redux/slices/profilesSlice";
import { setLocalStorage } from "../../../util/localStorage";
import { ConfigHeader } from "../components/ConfigHeader";
import { ContinueFeaturesMenu } from "../components/ContinueFeaturesMenu";
import { UserSetting } from "../components/UserSetting";
import { useLocalStorage } from "../../../context/LocalStorage";
import { useTranslation } from "react-i18next";
import i18n from "../../../locales/i18n";

export function UserSettingsSection() {
  /////// User settings section //////
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((state) => state.config.config);
  const currentOrg = useAppSelector(selectCurrentOrg);

  const [showExperimental, setShowExperimental] = useState(false);
  const { session } = useAuth();

  function handleUpdate(sharedConfig: SharedConfigSchema) {
    // Optimistic update
    const updatedConfig = modifyAnyConfigWithSharedConfig(config, sharedConfig);
    dispatch(updateConfig(updatedConfig));
    // IMPORTANT no need for model role updates (separate logic for selected model roles)
    // simply because this function won't be used to update model roles

    // Actual update to core which propagates back with config update event
    ideMessenger.post("config/updateSharedConfig", sharedConfig);
  }

  // Disable autocomplete
  const disableAutocompleteInFiles = (
    config.tabAutocompleteOptions?.disableInFiles ?? []
  ).join(", ");
  const [formDisableAutocomplete, setFormDisableAutocomplete] = useState(
    disableAutocompleteInFiles,
  );

  useEffect(() => {
    // Necessary so that reformatted/trimmed values don't cause dirty state
    setFormDisableAutocomplete(disableAutocompleteInFiles);
  }, [disableAutocompleteInFiles]);

  // Workspace prompts
  const promptPath = config.experimental?.promptPath || "";

  const handleEnableStaticContextualizationToggle = (value: boolean) => {
    handleUpdate({ enableStaticContextualization: value });
  };

  // TODO defaults are in multiple places, should be consolidated and probably not explicit here
  const showSessionTabs = config.ui?.showSessionTabs ?? false;
  const continueAfterToolRejection =
    config.ui?.continueAfterToolRejection ?? false;
  const codeWrap = config.ui?.codeWrap ?? false;
  const showChatScrollbar = config.ui?.showChatScrollbar ?? false;
  const readResponseTTS = config.experimental?.readResponseTTS ?? false;
  const displayRawMarkdown = config.ui?.displayRawMarkdown ?? false;
  const disableSessionTitles = config.disableSessionTitles ?? false;
  const useCurrentFileAsContext =
    config.experimental?.useCurrentFileAsContext ?? false;
  const enableExperimentalTools =
    config.experimental?.enableExperimentalTools ?? false;
  const onlyUseSystemMessageTools =
    config.experimental?.onlyUseSystemMessageTools ?? false;
  const codebaseToolCallingOnly =
    config.experimental?.codebaseToolCallingOnly ?? false;
  const enableStaticContextualization =
    config.experimental?.enableStaticContextualization ?? false;

  const allowAnonymousTelemetry = config.allowAnonymousTelemetry ?? true;

  const useAutocompleteMultilineCompletions =
    config.tabAutocompleteOptions?.multilineCompletions ?? "auto";
  const modelTimeout = config.tabAutocompleteOptions?.modelTimeout ?? 150;
  const debounceDelay = config.tabAutocompleteOptions?.debounceDelay ?? 250;
  const fontSize = useFontSize();
  const { language } = useLocalStorage();

  const cancelChangeDisableAutocomplete = () => {
    setFormDisableAutocomplete(disableAutocompleteInFiles);
  };
  const handleDisableAutocompleteSubmit = () => {
    handleUpdate({
      disableAutocompleteInFiles: formDisableAutocomplete
        .split(",")
        .map((val) => val.trim())
        .filter((val) => !!val),
    });
  };

  const hasContinueEmail = isContinueTeamMember(
    (session as HubSessionInfo)?.account?.id,
  );

  const disableTelemetryToggle =
    currentOrg?.policy?.allowAnonymousTelemetry === false;

  return (
    <div>
      <div className="flex flex-col">
        <ConfigHeader title={t("UserSettingsSection.UserSettings")} />
        <div className="space-y-6">
          {/* Chat Interface Settings */}
          <div>
            <ConfigHeader title={t("UserSettingsSection.Chat")} variant="sm" />
            <Card>
              <div className="flex flex-col gap-4">
                <UserSetting
                  type="toggle"
                  title={t("UserSettingsSection.ShowSessionTabs")}
                  description={t("UserSettingsSection.ShowSessionTabs")}
                  value={showSessionTabs}
                  onChange={(value) => handleUpdate({ showSessionTabs: value })}
                />
                <UserSetting
                  type="toggle"
                  title={t("UserSettingsSection.WrapCodeblocks")}
                  description={t("UserSettingsSection.WrapCodeblocksDesc")}
                  value={codeWrap}
                  onChange={(value) => handleUpdate({ codeWrap: value })}
                />
                <UserSetting
                  type="toggle"
                  title={t("UserSettingsSection.ShowChatScrollbar")}
                  description={t("UserSettingsSection.ShowChatScrollbarDesc")}
                  value={showChatScrollbar}
                  onChange={(value) =>
                    handleUpdate({ showChatScrollbar: value })
                  }
                />
                <UserSetting
                  type="toggle"
                  title={t("UserSettingsSection.Text-to-SpeechOutput")}
                  description={t(
                    "UserSettingsSection.Text-to-SpeechOutputDesc",
                  )}
                  value={readResponseTTS}
                  onChange={(value) => handleUpdate({ readResponseTTS: value })}
                />
                <UserSetting
                  type="toggle"
                  title={t("UserSettingsSection.EnableSessionTitles")}
                  description={t("UserSettingsSection.EnableSessionTitlesDesc")}
                  value={!disableSessionTitles}
                  onChange={(value) =>
                    handleUpdate({ disableSessionTitles: !value })
                  }
                />
                <UserSetting
                  type="toggle"
                  title={t("UserSettingsSection.FormatMarkdown")}
                  description={t("UserSettingsSection.FormatMarkdownDesc")}
                  value={!displayRawMarkdown}
                  onChange={(value) =>
                    handleUpdate({ displayRawMarkdown: !value })
                  }
                />
              </div>
            </Card>
          </div>

          {/* Telemetry Settings */}
          <div>
            <ConfigHeader
              title={t("UserSettingsSection.Telemetry")}
              variant="sm"
            />
            <Card>
              <div className="flex flex-col gap-4">
                <UserSetting
                  type="toggle"
                  title={t("UserSettingsSection.AllowAnonymousTelemetry")}
                  description={t(
                    "UserSettingsSection.AllowAnonymousTelemetryDesc",
                  )}
                  value={allowAnonymousTelemetry}
                  disabled={disableTelemetryToggle}
                  onChange={(value) =>
                    handleUpdate({ allowAnonymousTelemetry: value })
                  }
                />
              </div>
            </Card>
          </div>

          {/* Appearance Settings */}
          <div>
            <ConfigHeader
              title={t("UserSettingsSection.Appearance")}
              variant="sm"
            />
            <Card>
              <div className="flex flex-col gap-4">
                <UserSetting
                  type="number"
                  title={t("UserSettingsSection.FontSize")}
                  description={t("UserSettingsSection.FontSizeDesc")}
                  value={fontSize}
                  onChange={(val) => {
                    setLocalStorage("fontSize", val);
                    handleUpdate({ fontSize: val });
                  }}
                  min={7}
                  max={50}
                />
                <UserSetting
                  type="select"
                  title={t("UserSettingsSection.Language")}
                  description={t("UserSettingsSection.LanguageDesc")}
                  value={language}
                  onChange={(val) => {
                    setLocalStorage("language", val);
                    handleUpdate({ language: val });
                    i18n.changeLanguage(val);
                  }}
                  options={[
                    { label: "English", value: "en" },
                    { label: "简体中文", value: "zh" },
                  ]}
                />
              </div>
            </Card>
          </div>

          {/* Autocomplete Settings */}
          <div>
            <ConfigHeader
              title={t("UserSettingsSection.Autocomplete")}
              variant="sm"
            />
            <Card>
              <div className="flex flex-col gap-4">
                <UserSetting
                  type="select"
                  title={t("UserSettingsSection.MultilineAutocompletions")}
                  description={t(
                    "UserSettingsSection.MultilineAutocompletionsDesc",
                  )}
                  value={useAutocompleteMultilineCompletions}
                  onChange={(value) =>
                    handleUpdate({
                      useAutocompleteMultilineCompletions: value as
                        | "auto"
                        | "always"
                        | "never",
                    })
                  }
                  options={[
                    {
                      label: t(
                        "UserSettingsSection.MultilineAutocompletions-Auto",
                      ),
                      value: "auto",
                    },
                    {
                      label: t(
                        "UserSettingsSection.MultilineAutocompletions-Always",
                      ),
                      value: "always",
                    },
                    {
                      label: t(
                        "UserSettingsSection.MultilineAutocompletions-Never",
                      ),
                      value: "never",
                    },
                  ]}
                />
                <UserSetting
                  type="number"
                  title={t("UserSettingsSection.AutocompleteTimeout")}
                  description={t("UserSettingsSection.AutocompleteTimeoutDesc")}
                  value={modelTimeout}
                  onChange={(val) => handleUpdate({ modelTimeout: val })}
                  min={100}
                  max={5000}
                />
                <UserSetting
                  type="number"
                  title={t("UserSettingsSection.AutocompleteDebounce")}
                  description={t(
                    "UserSettingsSection.AutocompleteDebounceDesc",
                  )}
                  value={debounceDelay}
                  onChange={(val) => handleUpdate({ debounceDelay: val })}
                  min={0}
                  max={2500}
                />
                <UserSetting
                  type="input"
                  title={t("UserSettingsSection.DisableAutocompleteInFiles")}
                  description={t(
                    "UserSettingsSection.DisableAutocompleteInFilesDesc",
                  )}
                  placeholder="**/*.(txt,md)"
                  value={formDisableAutocomplete}
                  onChange={setFormDisableAutocomplete}
                  onSubmit={handleDisableAutocompleteSubmit}
                  onCancel={cancelChangeDisableAutocomplete}
                  isDirty={
                    formDisableAutocomplete !== disableAutocompleteInFiles
                  }
                  isValid={formDisableAutocomplete.trim() !== ""}
                />
              </div>
            </Card>
          </div>

          {/* Experimental Settings */}
          <div>
            <ConfigHeader
              title={t("UserSettingsSection.Experimental")}
              variant="sm"
            />
            <Card>
              <Toggle
                isOpen={showExperimental}
                onToggle={() => setShowExperimental(!showExperimental)}
                title={t("UserSettingsSection.ShowExperimentalSettings")}
              >
                <div className="flex flex-col gap-x-1 gap-y-4">
                  <UserSetting
                    type="toggle"
                    title={t("UserSettingsSection.AddCurrentFileByDefault")}
                    description={t(
                      "UserSettingsSection.AddCurrentFileByDefaultDesc",
                    )}
                    value={useCurrentFileAsContext}
                    onChange={(value) =>
                      handleUpdate({ useCurrentFileAsContext: value })
                    }
                  />
                  <UserSetting
                    type="toggle"
                    title={t("UserSettingsSection.EnableExperimentalTools")}
                    description={t(
                      "UserSettingsSection.EnableExperimentalToolsDesc",
                    )}
                    value={enableExperimentalTools}
                    onChange={(value) =>
                      handleUpdate({ enableExperimentalTools: value })
                    }
                  />
                  <UserSetting
                    type="toggle"
                    title={t("UserSettingsSection.OnlyUseSystemMessageTools")}
                    description={t(
                      "UserSettingsSection.OnlyUseSystemMessageToolsDesc",
                    )}
                    value={onlyUseSystemMessageTools}
                    onChange={(value) =>
                      handleUpdate({ onlyUseSystemMessageTools: value })
                    }
                  />
                  <UserSetting
                    type="toggle"
                    title={t("UserSettingsSection.useToolCallingOnly")}
                    description={t(
                      "UserSettingsSection.useToolCallingOnlyDesc",
                    )}
                    value={codebaseToolCallingOnly}
                    onChange={(value) =>
                      handleUpdate({ codebaseToolCallingOnly: value })
                    }
                  />
                  <UserSetting
                    type="toggle"
                    title={t("UserSettingsSection.StreamAfterToolRejection")}
                    description={t(
                      "UserSettingsSection.StreamAfterToolRejectionDesc",
                    )}
                    value={continueAfterToolRejection}
                    onChange={(value) =>
                      handleUpdate({ continueAfterToolRejection: value })
                    }
                  />

                  {hasContinueEmail && (
                    <ContinueFeaturesMenu
                      enableStaticContextualization={
                        enableStaticContextualization
                      }
                      handleEnableStaticContextualizationToggle={
                        handleEnableStaticContextualizationToggle
                      }
                    />
                  )}
                </div>
              </Toggle>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
