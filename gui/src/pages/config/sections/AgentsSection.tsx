import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { AssistantIcon } from "../../../components/AssistantAndOrgListbox/AssistantIcon";
import { ToolTip } from "../../../components/gui/Tooltip";
import { Button, Card, Divider, EmptyState } from "../../../components/ui";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppSelector } from "../../../redux/hooks";
import { ConfigHeader } from "../components/ConfigHeader";

export function AgentsSection() {
  const { profiles, selectedProfile } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);
  const configError = useAppSelector((state) => state.config.configError);

  function handleAddAgent() {
    void ideMessenger.request("config/newAssistantFile", undefined);
  }

  function handleConfigureAgent(profileId: string) {
    ideMessenger.post("config/openProfile", { profileId });
  }

  return (
    <>
      <ConfigHeader
        title="Agents"
        onAddClick={handleAddAgent}
        addButtonTooltip="Add agent"
      />

      <Card>
        {profiles && profiles.length > 0 ? (
          profiles.map((profile, index) => {
            const isSelected = profile.id === selectedProfile?.id;
            const errors = isSelected ? configError : profile.errors;
            return (
              <div key={profile.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-3">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
                      <AssistantIcon assistant={profile} />
                    </div>
                    <div className="flex-1">
                      <h3
                        className={`my-2 text-sm font-medium ${errors && errors.length > 0 ? "text-error" : ""}`}
                      >
                        {profile.title}
                      </h3>
                      {errors && errors.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {errors.map((error, errorIndex) => (
                            <div
                              key={errorIndex}
                              className="text-error bg-error/10 rounded py-1 pr-2 text-xs"
                            >
                              {error.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <ToolTip content="Configure agent">
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
                {index < profiles.length - 1 && <Divider />}
              </div>
            );
          })
        ) : (
          <EmptyState message="No agents configured. Click the + button to add your first agent." />
        )}
      </Card>
    </>
  );
}
