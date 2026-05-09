import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { AssistantIcon } from "../../../components/AssistantAndOrgListbox/AssistantIcon";
import { ToolTip } from "../../../components/gui/Tooltip";
import { Button, EmptyState } from "../../../components/ui";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppSelector } from "../../../redux/hooks";
import { ConfigHeader } from "../components/ConfigHeader";
import { SettingsPanel } from "../components/SettingsPanel";

export function ConfigsSection() {
  const { profiles, selectedProfile } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);
  const configError = useAppSelector((state) => state.config.configError);

  function handleAddConfig() {
    // Fire-and-forget action. Using `post` avoids UI stalls if the host
    // doesn't send a request response for this mutation-only command.
    ideMessenger.post("config/newAssistantFile", undefined);
  }

  function handleConfigureAgent(profileId: string) {
    ideMessenger.post("config/openProfile", { profileId });
  }

  return (
    <>
      <ConfigHeader
        title="Agents & Configs"
        subtext="Manage assistant profiles, workspace configs, and the active agent for this session."
        onAddClick={handleAddConfig}
        addButtonTooltip="Add config"
      />

      <SettingsPanel anchorId="agent-configs">
        {profiles && profiles.length > 0 ? (
          profiles.map((profile) => {
            const isSelected = profile.id === selectedProfile?.id;
            const errors = isSelected ? configError : profile.errors;
            const hasFatalErrors =
              errors && errors.some((error) => error.fatal);
            const hasErrors = errors && errors.length > 0;
            return (
              <div key={profile.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
                      <AssistantIcon assistant={profile} />
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={`my-0 text-sm font-medium ${
                            hasFatalErrors
                              ? "text-error"
                              : hasErrors
                                ? "text-yellow-500"
                                : ""
                          }`}
                        >
                          {profile.title}
                        </h3>
                        {isSelected && (
                          <span className="bg-vsc-input-background text-description rounded-full px-2 py-0.5 text-[11px] font-medium">
                            Active
                          </span>
                        )}
                      </div>
                      {errors && errors.length > 0 && (
                        <div className="space-y-1 overflow-hidden">
                          {errors.map((error, errorIndex) => (
                            <div
                              onClick={(e) => {
                                if (error.uri) {
                                  e.stopPropagation();
                                  ideMessenger.post("openFile", {
                                    path: error.uri,
                                  });
                                }
                              }}
                              key={errorIndex}
                              className={`${
                                error.fatal
                                  ? "text-error bg-error/10"
                                  : "bg-yellow-500/10 text-yellow-500"
                              } break-all rounded border border-solid border-transparent px-2 py-1 text-xs ${error.uri ? "cursor-pointer " + (error.fatal ? "hover:border-error" : "hover:border-yellow-500") : ""}`}
                            >
                              {error.message.split("\n")[0]}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <ToolTip content="Open configuration">
                    <Button
                      onClick={() => handleConfigureAgent(profile.id)}
                      variant="ghost"
                      size="sm"
                      className="text-description-muted hover:enabled:text-foreground my-0 h-6 w-6 p-0"
                    >
                      <Cog6ToothIcon className="h-4 w-4 flex-shrink-0" />
                    </Button>
                  </ToolTip>
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState message="No agents configured. Click the + button to add your first agent." />
        )}
      </SettingsPanel>
    </>
  );
}
