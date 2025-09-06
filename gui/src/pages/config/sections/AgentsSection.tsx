import { Cog6ToothIcon, PlusCircleIcon } from "@heroicons/react/24/outline";
import { useContext } from "react";
import { AssistantIcon } from "../../../components/AssistantAndOrgListbox/AssistantIcon";
import { ToolTip } from "../../../components/gui/Tooltip";
import { Button, Card, Divider, EmptyState } from "../../../components/ui";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";

export function AgentsSection() {
  const { profiles } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);

  function handleAddAgent() {
    ideMessenger.request("config/newAssistantFile", undefined);
  }

  function handleConfigureAgent(profileId: string) {
    ideMessenger.post("config/openProfile", { profileId });
  }

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="mb-0 text-xl font-semibold">Agents</h2>
        </div>
        <Button
          onClick={handleAddAgent}
          variant="ghost"
          size="sm"
          className="my-0 h-8 w-8 p-0"
        >
          <PlusCircleIcon className="text-description h-5 w-5" />
        </Button>
      </div>

      <Card>
        {profiles && profiles.length > 0 ? (
          profiles.map((profile, index) => (
            <div key={profile.id}>
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
                    <AssistantIcon assistant={profile} />
                  </div>
                  <div className="flex-1">
                    <h3
                      className={`text-sm font-medium ${profile.errors && profile.errors.length > 0 ? "text-error" : ""}`}
                    >
                      {profile.title}
                    </h3>
                    {profile.errors && profile.errors.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {profile.errors.map((error, errorIndex) => (
                          <div
                            key={errorIndex}
                            className="text-error bg-error/10 rounded px-2 py-1 text-xs"
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
                    className="my-0 h-8 w-8 p-0"
                  >
                    <Cog6ToothIcon className="text-description h-4 w-4" />
                  </Button>
                </ToolTip>
              </div>
              {index < profiles.length - 1 && <Divider />}
            </div>
          ))
        ) : (
          <EmptyState message="No agents configured. Click the + button to add your first agent." />
        )}
      </Card>
    </>
  );
}
