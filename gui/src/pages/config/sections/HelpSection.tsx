import {
  DocumentArrowUpIcon,
  LinkIcon,
  NumberedListIcon,
  PaintBrushIcon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";
import { useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Shortcut from "../../../components/gui/Shortcut";
import { Card } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { setOnboardingCard } from "../../../redux/slices/uiSlice";
import { saveCurrentSession } from "../../../redux/thunks/session";
import { isJetBrains } from "../../../util";
import { ROUTES } from "../../../util/navigation";
import { ConfigHeader } from "../components/ConfigHeader";
import { ConfigRow } from "../components/ConfigRow";

interface KeyboardShortcutProps {
  shortcut: string;
  description: string;
  isEven: boolean;
}

function KeyboardShortcut(props: KeyboardShortcutProps) {
  return (
    <div
      className={`flex flex-col items-start p-3 sm:flex-row sm:items-center ${props.isEven ? "" : "bg-vsc-editor-background/50"}`}
    >
      <div className="w-full flex-grow pb-2 pr-4 sm:w-auto sm:pb-0">
        <span className="block break-words text-sm">{props.description}:</span>
      </div>
      <div className="flex-shrink-0 whitespace-nowrap">
        <Shortcut>{props.shortcut}</Shortcut>
      </div>
    </div>
  );
}

// Shortcut strings will be rendered correctly based on the platform by the Shortcut component
const vscodeShortcuts: Omit<KeyboardShortcutProps, "isEven">[] = [
  {
    shortcut: "cmd '",
    description: "Toggle Selected Model",
  },
  {
    shortcut: "cmd I",
    description: "Edit highlighted code",
  },
  {
    shortcut: "cmd L",
    description:
      "New Chat / New Chat With Selected Code / Close Continue Sidebar If Chat Already In Focus",
  },
  {
    shortcut: "cmd backspace",
    description: "Cancel response",
  },
  {
    shortcut: "cmd shift I",
    description: "Toggle inline edit focus",
  },
  {
    shortcut: "cmd shift L",
    description:
      "Focus Current Chat / Add Selected Code To Current Chat / Close Continue Sidebar If Chat Already In Focus",
  },
  {
    shortcut: "cmd shift R",
    description: "Debug Terminal",
  },
  {
    shortcut: "cmd shift backspace",
    description: "Reject Diff",
  },
  {
    shortcut: "cmd shift enter",
    description: "Accept Diff",
  },
  {
    shortcut: "alt cmd N",
    description: "Reject Top Change in Diff",
  },
  {
    shortcut: "alt cmd Y",
    description: "Accept Top Change in Diff",
  },
  {
    shortcut: "cmd K cmd A",
    description: "Toggle Autocomplete Enabled",
  },
  {
    shortcut: "cmd alt space",
    description: "Force an Autocomplete Trigger",
  },
  {
    shortcut: "cmd K cmd M",
    description: "Toggle Full Screen",
  },
];

const jetbrainsShortcuts: Omit<KeyboardShortcutProps, "isEven">[] = [
  {
    shortcut: "cmd '",
    description: "Toggle Selected Model",
  },
  {
    shortcut: "cmd I",
    description: "Edit highlighted code",
  },
  {
    shortcut: "cmd J",
    description:
      "New Chat / New Chat With Selected Code / Close Continue Sidebar If Chat Already In Focus",
  },
  {
    shortcut: "cmd backspace",
    description: "Cancel response",
  },
  {
    shortcut: "cmd shift I",
    description: "Toggle inline edit focus",
  },
  {
    shortcut: "cmd shift J",
    description:
      "Focus Current Chat / Add Selected Code To Current Chat / Close Continue Sidebar If Chat Already In Focus",
  },
  {
    shortcut: "cmd shift backspace",
    description: "Reject Diff",
  },
  {
    shortcut: "cmd shift enter",
    description: "Accept Diff",
  },
  {
    shortcut: "alt shift J",
    description: "Quick Input",
  },
  {
    shortcut: "alt cmd J",
    description: "Toggle Sidebar",
  },
];

export function HelpSection() {
  const ideMessenger = useContext(IdeMessengerContext);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const currentSession = useAppSelector((state) => state.session);

  const shortcuts = useMemo(() => {
    return isJetBrains() ? jetbrainsShortcuts : vscodeShortcuts;
  }, []);

  const handleViewSessionData = async () => {
    const sessionData = await ideMessenger.request("history/load", {
      id: currentSession.id,
    });

    if (sessionData.status === "success") {
      await ideMessenger.request("showVirtualFile", {
        name: `${sessionData.content.title}.json`,
        content: JSON.stringify(sessionData.content, null, 2),
      });
    }
  };

  return (
    <div className="flex flex-col">
      <ConfigHeader title="Help Center" />
      <div className="space-y-6">
        {/* Resources */}
        <div>
          <h3 className="mb-3 text-base font-medium">Resources</h3>
          <Card className="!p-0">
            <div className="flex flex-col">
              <ConfigRow
                title="Continue Hub"
                description="Visit hub.continue.dev to explore custom agents and blocks"
                icon={LinkIcon}
                onClick={() =>
                  ideMessenger.post("openUrl", "https://hub.continue.dev/")
                }
              />

              <ConfigRow
                title="Documentation"
                description="Learn how to configure and use Continue"
                icon={LinkIcon}
                onClick={() =>
                  ideMessenger.post("openUrl", "https://docs.continue.dev/")
                }
              />

              <ConfigRow
                title="Have an issue?"
                description="Let us know on GitHub and we'll do our best to resolve it"
                icon={LinkIcon}
                onClick={() =>
                  ideMessenger.post(
                    "openUrl",
                    "https://github.com/continuedev/continue/issues/new/choose",
                  )
                }
              />

              <ConfigRow
                title="Join the community!"
                description="Join us on Discord to stay up-to-date on the latest developments"
                icon={LinkIcon}
                onClick={() =>
                  ideMessenger.post("openUrl", "https://discord.gg/vapESyrFmJ")
                }
              />
            </div>
          </Card>
        </div>

        {/* Tools */}
        <div>
          <h3 className="mb-3 text-base font-medium">Tools</h3>
          <Card className="!p-0">
            <div className="flex flex-col">
              <ConfigRow
                title="Token usage"
                description="Daily token usage across models"
                icon={TableCellsIcon}
                onClick={() => navigate(ROUTES.STATS)}
              />

              {currentSession.history.length > 0 &&
                !currentSession.isStreaming && (
                  <ConfigRow
                    title="View current session history"
                    description="Open the current chat session file for troubleshooting"
                    icon={NumberedListIcon}
                    onClick={handleViewSessionData}
                  />
                )}

              <ConfigRow
                title="Quickstart"
                description="Reopen the quickstart and tutorial file"
                icon={DocumentArrowUpIcon}
                onClick={async () => {
                  navigate("/");
                  // Used to clear the chat panel before showing onboarding card
                  await dispatch(
                    saveCurrentSession({
                      openNewSession: true,
                      generateTitle: true,
                    }),
                  );
                  dispatch(
                    setOnboardingCard({
                      show: true,
                      activeTab: undefined,
                    }),
                  );
                  ideMessenger.post("showTutorial", undefined);
                }}
              />

              {process.env.NODE_ENV === "development" && (
                <ConfigRow
                  title="Theme Test Page"
                  description="Development page for testing themes"
                  icon={PaintBrushIcon}
                  onClick={async () => {
                    navigate(ROUTES.THEME);
                  }}
                />
              )}
            </div>
          </Card>
        </div>

        {/* Keyboard Shortcuts */}
        <div>
          <h3 className="mb-3 text-base font-medium">Keyboard Shortcuts</h3>
          <Card className="!p-0">
            <div className="overflow-hidden rounded-md border border-gray-600">
              {shortcuts.map((shortcut, i) => {
                return (
                  <KeyboardShortcut
                    key={i}
                    shortcut={shortcut.shortcut}
                    description={shortcut.description}
                    isEven={i % 2 === 0}
                  />
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
