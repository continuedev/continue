import { ConfigYaml, parseConfigYaml } from "@continuedev/config-yaml";
import {
  ArrowPathIcon,
  ChevronDownIcon,
  CircleStackIcon,
  CommandLineIcon,
  GlobeAltIcon,
  UserCircleIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { MCPServerStatus } from "core";
import { useContext, useMemo, useState } from "react";
import { ToolTip } from "../../../components/gui/Tooltip";
import EditBlockButton from "../../../components/mainInput/Lump/EditBlockButton";
import { Button, Card } from "../../../components/ui";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { updateConfig } from "../../../redux/slices/configSlice";
import { selectCurrentOrg } from "../../../redux/slices/profilesSlice";
import { ConfigHeader } from "../components/ConfigHeader";

interface MCPServerStatusProps {
  server: MCPServerStatus;
  serverFromYaml?: NonNullable<ConfigYaml["mcpServers"]>[number];
}
function MCPServerCard({ server, serverFromYaml }: MCPServerStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((store) => store.config.config);
  const dispatch = useAppDispatch();

  const updateMCPServerStatus = (status: MCPServerStatus["status"]) => {
    // optimistic config update
    dispatch(
      updateConfig({
        ...config,
        mcpServerStatuses: config.mcpServerStatuses.map((s) =>
          s.id === server.id
            ? {
                ...s,
                status,
              }
            : s,
        ),
      }),
    );
  };

  const onAuthenticate = async () => {
    updateMCPServerStatus("authenticating");
    await ideMessenger.request("mcp/startAuthentication", server);
  };

  const onRemoveAuth = async () => {
    updateMCPServerStatus("authenticating");
    await ideMessenger.request("mcp/removeAuthentication", server);
  };

  const onRefresh = async () => {
    updateMCPServerStatus("connecting");
    ideMessenger.post("mcp/reloadServer", {
      id: server.id,
    });
  };

  const handleToggleExpanded = (e: React.MouseEvent) => {
    // Don't expand if clicking on buttons
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <div>
      <div
        className="hover:bg-input/50 -mx-2 flex cursor-pointer items-center justify-between rounded px-2 py-1"
        onClick={handleToggleExpanded}
      >
        <div className="flex items-center gap-3">
          <ChevronDownIcon
            className={`text-description h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
          <div className="flex-1">
            <h3
              className={`text-sm font-medium ${server.errors && server.errors.length > 0 ? "text-error" : ""}`}
            >
              {server.name}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {server.isProtectedResource && (
            <ToolTip
              content={
                server.status === "error"
                  ? "Authenticate"
                  : server.status === "authenticating"
                    ? "Authenticating..."
                    : "Remove authentication"
              }
            >
              <Button
                onClick={
                  server.status === "error"
                    ? onAuthenticate
                    : server.status === "authenticating"
                      ? undefined
                      : onRemoveAuth
                }
                variant="ghost"
                size="sm"
                className="text-description-muted hover:enabled:text-foreground my-0 h-6 w-6 p-0"
                disabled={server.status === "authenticating"}
              >
                {server.status === "authenticating" ? (
                  <GlobeAltIcon className="animate-spin-slow h-4 w-4 flex-shrink-0" />
                ) : (
                  <UserCircleIcon className="h-4 w-4 flex-shrink-0" />
                )}
              </Button>
            </ToolTip>
          )}

          <EditBlockButton
            blockType={"mcpServers"}
            block={serverFromYaml}
            sourceFile={server.sourceFile}
          />

          <ToolTip content="Refresh server">
            <Button
              onClick={onRefresh}
              variant="ghost"
              size="sm"
              className="text-description-muted hover:enabled:text-foreground my-0 h-6 w-6 p-0"
            >
              <ArrowPathIcon className="h-4 w-4 flex-shrink-0" />
            </Button>
          </ToolTip>

          <div
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{
              backgroundColor:
                server.status === "connected"
                  ? "#22c55e" // green-500
                  : server.status === "connecting"
                    ? "#eab308" // yellow-500
                    : server.status === "not-connected"
                      ? "#78716c" // stone-500
                      : "#ef4444", // red-500 for error
            }}
          />
        </div>
      </div>

      {isExpanded && server.status === "connected" && (
        <div className="mt-3 pl-7">
          {/* Tools, Prompts, Resources with counts */}
          <div className="mb-3 flex flex-row items-center gap-6">
            <ToolTip
              className="flex flex-col gap-0.5"
              content={
                <>
                  {server.tools.map((tool, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <div className="flex flex-col">
                        <code className="font-semibold">{tool.name}</code>
                        {tool.description && (
                          <span className="mt-0.5 text-xs text-gray-400">
                            {tool.description}
                          </span>
                        )}
                        {tool.inputSchema?.properties &&
                          Object.keys(tool.inputSchema.properties).length >
                            0 && (
                            <div className="mt-1">
                              <span className="text-xs text-gray-500">
                                Args:
                              </span>
                              <div className="ml-2">
                                {Object.entries(
                                  tool.inputSchema.properties,
                                ).map(([paramName, paramSchema], paramIdx) => (
                                  <div key={paramIdx} className="text-xs">
                                    <code className="text-blue-400">
                                      {paramName}
                                    </code>
                                    {paramSchema &&
                                      typeof paramSchema === "object" &&
                                      "type" in paramSchema && (
                                        <span className="ml-1 text-gray-500">
                                          ({paramSchema.type})
                                        </span>
                                      )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                      {idx < server.tools.length - 1 && (
                        <div className="my-1 border-b border-gray-600"></div>
                      )}
                    </div>
                  ))}
                  {server.tools.length === 0 && (
                    <span className="text-lightgray">No tools</span>
                  )}
                </>
              }
            >
              <div className="flex cursor-zoom-in items-center gap-2 hover:opacity-80">
                <WrenchScrewdriverIcon className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">Tools: {server.tools.length}</span>
              </div>
            </ToolTip>

            <ToolTip
              className="flex flex-col gap-0.5"
              content={
                <>
                  {server.prompts.map((prompt, idx) => (
                    <code key={idx}>{prompt.name}</code>
                  ))}
                  {server.prompts.length === 0 && (
                    <span className="text-lightgray">No prompts</span>
                  )}
                </>
              }
            >
              <div className="flex cursor-zoom-in items-center gap-2 hover:opacity-80">
                <CommandLineIcon className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">
                  Prompts: {server.prompts.length}
                </span>
              </div>
            </ToolTip>

            <ToolTip
              className="flex flex-col gap-0.5"
              content={
                <>
                  {[...server.resources, ...server.resourceTemplates].map(
                    (resource, idx) => (
                      <code key={idx}>{resource.name}</code>
                    ),
                  )}
                  {server.resources.length === 0 && (
                    <span className="text-lightgray">No resources</span>
                  )}
                </>
              }
            >
              <div className="flex cursor-zoom-in items-center gap-2 hover:opacity-80">
                <CircleStackIcon className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">
                  Resources:{" "}
                  {server.resources.length + server.resourceTemplates.length}
                </span>
              </div>
            </ToolTip>
          </div>
        </div>
      )}

      {/* Error display below expandable section */}
      {server.errors && server.errors.length > 0 && (
        <div className="mt-2 space-y-1">
          {server.errors.map((error, errorIndex) => (
            <div
              key={errorIndex}
              className="text-error bg-error/10 rounded px-2 py-1 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex-1">
                  {error.length > 150 ? error.substring(0, 150) + "..." : error}
                </span>
                {error.length > 150 && (
                  <Button
                    className="my-0 flex-shrink-0"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void ideMessenger.ide.showVirtualFile(server.name, error)
                    }
                  >
                    View full error
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function McpSection() {
  const currentOrg = useAppSelector(selectCurrentOrg);
  const servers = useAppSelector(
    (store) => store.config.config.mcpServerStatuses,
  );
  const { selectedProfile } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);
  const disableMcp = currentOrg?.policy?.allowMcpServers === false;
  const isLocal = selectedProfile?.profileType === "local";

  const mergedBlocks = useMemo(() => {
    const parsed = selectedProfile?.rawYaml
      ? parseConfigYaml(selectedProfile?.rawYaml ?? "")
      : undefined;
    return (servers ?? []).map((doc, index) => ({
      block: doc,
      blockFromYaml: parsed?.mcpServers?.[index],
    }));
  }, [servers, selectedProfile]);

  const handleAddMcpServer = () => {
    if (isLocal) {
      void ideMessenger.request("config/addLocalWorkspaceBlock", {
        blockType: "mcpServers",
      });
    } else {
      void ideMessenger.request("controlPlane/openUrl", {
        path: "new?type=block&blockType=mcpServers",
        orgSlug: undefined,
      });
    }
  };

  if (disableMcp) {
    return (
      <div className="flex flex-col items-center justify-center p-2">
        <span className="text-description">
          MCP servers are disabled in your organization
        </span>
      </div>
    );
  }

  return (
    <div>
      <ConfigHeader
        title="MCP Servers"
        onAddClick={handleAddMcpServer}
        addButtonTooltip="Add MCP server"
      />

      <div className="mt-6">
        {mergedBlocks && mergedBlocks.length > 0 ? (
          mergedBlocks.map(({ block, blockFromYaml }, index) => (
            <div key={block.id}>
              <Card>
                <MCPServerCard server={block} serverFromYaml={blockFromYaml} />
              </Card>
              {index < mergedBlocks.length - 1 && <div className="mb-4" />}
            </div>
          ))
        ) : (
          <Card>
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <span className="text-description">
                No MCP servers configured. Click the + button to add your first
                server.
              </span>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

export { McpSection };
