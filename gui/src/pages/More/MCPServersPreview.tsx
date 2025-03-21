import {
  CircleStackIcon,
  CommandLineIcon,
  InformationCircleIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { MCPServerStatus } from "core";
import { useContext } from "react";
import { SecondaryButton } from "../../components";
import { ToolTip } from "../../components/gui/Tooltip";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { updateConfig } from "../../redux/slices/configSlice";

interface MCPServerStatusProps {
  server: MCPServerStatus;
}
function MCPServerPreview({ server }: MCPServerStatusProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((store) => store.config.config);
  const dispatch = useAppDispatch();
  const toolsTooltipId = `${server.id}-tools`;
  const promptsTooltipId = `${server.id}-prompts`;
  const resourcesTooltipId = `${server.id}-resources`;
  const errorsTooltipId = `${server.id}-errors`;

  async function onRefresh() {
    // optimistic config update
    dispatch(
      updateConfig({
        ...config,
        mcpServerStatuses: config.mcpServerStatuses.map((s) =>
          s.id === server.id
            ? {
                ...s,
                status: "connecting",
              }
            : s,
        ),
      }),
    );
    ideMessenger.post("mcp/reloadServer", {
      id: server.id,
    });
  }

  return (
    <div className="flex flex-col gap-1.5 pb-4">
      <h3 className="m-0 mb-1 text-base">{server.name}</h3>
      <div className="flex flex-row items-center justify-between gap-3">
        {server.status === "not-connected" ? (
          <div className="flex flex-row items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-stone-500"></div>
            <span>Not connected</span>
          </div>
        ) : server.status === "connected" ? (
          <div className="flex flex-row items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span>Connected</span>
          </div>
        ) : server.status === "connecting" ? (
          <div className="flex flex-row items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
            <span>Connecting...</span>
          </div>
        ) : (
          <div className="flex flex-row items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500"></div>
            <span>Error</span>
            <InformationCircleIcon
              className="h-3 w-3"
              data-tooltip-id={errorsTooltipId}
            />
            <ToolTip id={errorsTooltipId} className="flex flex-col gap-0.5">
              {server.errors.map((error, idx) => (
                <code key={idx}>{error}</code>
              ))}
              {server.errors.length === 0 ? (
                <span className="text-stone-500">No known errors</span>
              ) : null}
            </ToolTip>
          </div>
        )}
        <span
          className="text-lightgray cursor-pointer underline hover:opacity-80"
          onClick={onRefresh}
        >
          Refresh
        </span>
      </div>
      <div className="relative flex flex-row flex-wrap items-center gap-4">
        {/* Tools */}
        <div
          className="flex cursor-zoom-in flex-row items-center gap-2 hover:opacity-80"
          data-tooltip-id={toolsTooltipId}
        >
          <WrenchScrewdriverIcon className="h-4 w-4" />
          <span>{`Tools: ${server.tools.length}`}</span>
        </div>
        <ToolTip id={toolsTooltipId} className="flex flex-col gap-0.5">
          {server.tools.map((tool, idx) => (
            <code key={idx}>{tool.name}</code>
          ))}
          {server.tools.length === 0 ? (
            <span className="text-stone-500">No tools</span>
          ) : null}
        </ToolTip>

        {/* Prompts */}
        <div
          className="flex cursor-zoom-in flex-row items-center gap-2 hover:opacity-80"
          data-tooltip-id={promptsTooltipId}
        >
          <CommandLineIcon className="h-4 w-4" />
          <span>{`Prompts: ${server.prompts.length}`}</span>
        </div>
        <ToolTip id={promptsTooltipId} className="flex flex-col gap-0.5">
          {server.prompts.map((prompt, idx) => (
            <code key={idx}>{prompt.name}</code>
          ))}
          {server.prompts.length === 0 ? (
            <span className="text-stone-500">No prompts</span>
          ) : null}
        </ToolTip>
        {/* Resources */}
        <div
          className="flex cursor-zoom-in flex-row items-center gap-2 hover:opacity-80"
          data-tooltip-id={resourcesTooltipId}
        >
          <CircleStackIcon className="h-4 w-4" />
          <span>{`Resources: ${server.resources.length}`}</span>
        </div>
        <ToolTip id={resourcesTooltipId} className="flex flex-col gap-0.5">
          {server.resources.map((resource, idx) => (
            <code key={idx}>{resource.name}</code>
          ))}
          {server.resources.length === 0 ? (
            <span className="text-stone-500">No resources</span>
          ) : null}
        </ToolTip>
      </div>
    </div>
  );
}
function MCPServersPreview() {
  const servers = useAppSelector(
    (store) => store.config.config.mcpServerStatuses,
  );
  const ideMessenger = useContext(IdeMessengerContext);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-row items-center justify-between">
        <h3 className="mb-0 mt-0 text-lg">MCP Servers</h3>
      </div>

      <div className="flex max-h-[170px] flex-col gap-1 overflow-y-auto overflow-x-hidden pr-2">
        <div>
          {servers.length === 0 && (
            <SecondaryButton
              className="flex h-7 flex-col items-center justify-center"
              onClick={() => {
                ideMessenger.post("config/openProfile", {
                  profileId: undefined,
                });
              }}
            >
              Add MCP Servers
            </SecondaryButton>
          )}
        </div>
        {servers.map((server, idx) => (
          <MCPServerPreview key={idx} server={server} />
        ))}
      </div>
    </div>
  );
}

export default MCPServersPreview;
