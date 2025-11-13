import { ConfigYaml, parseConfigYaml } from "@continuedev/config-yaml";
import {
  ArrowPathIcon,
  ChevronDownIcon,
  CircleStackIcon,
  CommandLineIcon,
  EllipsisVerticalIcon,
  GlobeAltIcon,
  PencilIcon,
  PlayCircleIcon,
  StopCircleIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { MCPConnectionStatus, MCPServerStatus } from "core";
import { BUILT_IN_GROUP_NAME } from "core/tools/builtIn";
import { useContext, useMemo, useState } from "react";
import Alert from "../../../components/gui/Alert";
import { ToolTip } from "../../../components/gui/Tooltip";
import { useEditBlock } from "../../../components/mainInput/Lump/useEditBlock";
import {
  Button,
  Card,
  EmptyState,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "../../../components/ui";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { updateConfig } from "../../../redux/slices/configSlice";
import { selectCurrentOrg } from "../../../redux/slices/profilesSlice";
import { ConfigHeader } from "../components/ConfigHeader";
import { ToolPoliciesGroup } from "../components/ToolPoliciesGroup";

interface MCPServerStatusProps {
  allToolsOff: boolean;
  server: MCPServerStatus;
  serverFromYaml?: NonNullable<ConfigYaml["mcpServers"]>[number];
  duplicateDetection: Record<string, boolean>;
}

const ServerStatusTooltip: Record<MCPConnectionStatus, string> = {
  connected: "Active",
  connecting: "Connecting",
  "not-connected": "Inactive",
  disabled: "Off",
  authenticating: "Authenticating",
  error: "Error",
};

const ServerStatusColor: Record<MCPConnectionStatus, string> = {
  connected: "bg-success",
  connecting: "bg-warning",
  "not-connected": "bg-description-muted",
  disabled: "bg-description-muted",
  authenticating: "bg-warning",
  error: "bg-error",
};

function MCPServerPreview({
  server,
  serverFromYaml,
  allToolsOff,
  duplicateDetection,
}: MCPServerStatusProps) {
  const [expandedSections, setExpandedSections] = useState<{
    [key: string]: boolean;
  }>({});
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((store) => store.config.config);
  const editBlock = useEditBlock();

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
    if ("url" in server) {
      updateMCPServerStatus("authenticating");
      await ideMessenger.request("mcp/startAuthentication", {
        serverId: server.id,
        serverUrl: server.url,
      });
    }
  };

  const onRemoveAuth = async () => {
    if ("url" in server) {
      updateMCPServerStatus("authenticating");
      await ideMessenger.request("mcp/removeAuthentication", {
        serverId: server.id,
        serverUrl: server.url,
      });
    }
  };

  const onRefresh = async () => {
    updateMCPServerStatus("connecting");
    if (server.status === "disabled") {
      await ideMessenger.request("mcp/setServerEnabled", {
        id: server.id,
        enabled: true,
      });
    } else {
      await ideMessenger.request("mcp/reloadServer", {
        id: server.id,
      });
    }
  };

  const onDisconnect = async () => {
    updateMCPServerStatus("disabled");
    dispatch(
      updateConfig({
        ...config,
        tools: config.tools.filter((tool) => tool.group !== server.id),
      }),
    );
    await ideMessenger.request("mcp/setServerEnabled", {
      id: server.id,
      enabled: false,
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const ResourceRow = ({
    title,
    items,
    icon,
    sectionKey,
  }: {
    title: string;
    items:
      | MCPServerStatus["prompts"]
      | MCPServerStatus["resources"]
      | MCPServerStatus["resourceTemplates"];
    icon: React.ReactNode;
    sectionKey: string;
  }) => {
    const isExpanded = expandedSections[sectionKey];
    const hasItems = items.length > 0;

    return (
      <div>
        <div
          className="mx-2 flex cursor-pointer items-center justify-between rounded hover:bg-gray-50 hover:bg-opacity-5"
          onClick={() => toggleSection(sectionKey)}
        >
          <div className="flex items-center gap-3">
            <ChevronDownIcon
              className={`text-description h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            />
            <div className="flex items-center gap-2">
              {icon}
              <span className="text-sm">{title}</span>
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gray-600 px-0.5 text-xs font-medium text-white">
                {items.length}
              </div>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="mx-2 my-2 mb-3">
            {hasItems ? (
              <div className="space-y-1">
                {items.map((item, idx) => {
                  return (
                    <div
                      key={idx}
                      className="text-description rounded bg-gray-50 bg-opacity-5 px-2 py-1 text-xs"
                    >
                      <code>{item.name}</code>
                      {item.description && (
                        <div className="mt-1 text-xs text-gray-500">
                          {item.description}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs italic text-gray-500">
                No {title.toLowerCase()} available
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="">
      <div className="flex items-center justify-between py-1">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="my-0 text-sm font-medium">{server.name}</h3>
              <ToolTip content={ServerStatusTooltip[server.status] ?? "Error"}>
                <div
                  className={`h-2 w-2 flex-shrink-0 rounded-full ${ServerStatusColor[server.status] ?? "bg-error"}`}
                />
              </ToolTip>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {server.isProtectedResource &&
            "url" in server &&
            server.status !== "connected" && (
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
                  className="text-description-muted hover:enabled:text-foreground my-0 h-6 w-6 p-0 pt-0.5"
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
          <Listbox>
            <ListboxButton>
              <EllipsisVerticalIcon className="h-4 w-4 flex-shrink-0" />
            </ListboxButton>
            <ListboxOptions className="min-w-fit" anchor="bottom end">
              {server.isProtectedResource && server.status === "connected" && (
                <ListboxOption
                  value="remove auth"
                  onClick={onRemoveAuth}
                  className="justify-start gap-x-1.5"
                >
                  <UserCircleIcon className="h-4 w-4 flex-shrink-0" /> Logout
                </ListboxOption>
              )}

              <ListboxOption
                value="edit mcp"
                className="justify-start gap-x-1.5"
                onClick={() =>
                  editBlock(
                    serverFromYaml && "uses" in serverFromYaml
                      ? serverFromYaml.uses
                      : undefined,
                    server.sourceFile,
                  )
                }
              >
                <PencilIcon
                  className={
                    "h-3.5 w-3.5 flex-shrink-0 cursor-pointer text-gray-400 text-inherit hover:brightness-125"
                  }
                />
                Edit
              </ListboxOption>

              {server.status === "connected" && (
                <ListboxOption
                  value="disconnect"
                  onClick={onDisconnect}
                  className="justify-start gap-x-1.5"
                >
                  <StopCircleIcon className="h-4 w-4 flex-shrink-0" />{" "}
                  Disconnect
                </ListboxOption>
              )}

              {server.status !== "connecting" && (
                <ListboxOption
                  value="reconnect"
                  onClick={onRefresh}
                  className="justify-start gap-x-1.5"
                >
                  {server.status === "disabled" ? (
                    <PlayCircleIcon className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ArrowPathIcon className="h-4 w-4 flex-shrink-0" />
                  )}
                  Reload
                </ListboxOption>
              )}
            </ListboxOptions>
          </Listbox>
        </div>
      </div>

      {/* Individual resource rows */}
      <div className="mt-1">
        <ToolPoliciesGroup
          showIcon={true}
          groupName={server.name}
          displayName={"Tools"}
          allToolsOff={allToolsOff}
          duplicateDetection={duplicateDetection}
        />
        {server.prompts.length > 0 && (
          <ResourceRow
            title="Prompts"
            items={server.prompts}
            icon={
              <CommandLineIcon className="text-description h-4 w-4 flex-shrink-0" />
            }
            sectionKey={`${server.id}-prompts`}
          />
        )}
        {(server.resources.length > 0 ||
          server.resourceTemplates.length > 0) && (
          <ResourceRow
            title="Resources"
            items={[...server.resources, ...server.resourceTemplates]}
            icon={
              <CircleStackIcon className="text-description h-4 w-4 flex-shrink-0" />
            }
            sectionKey={`${server.id}-resources`}
          />
        )}
      </div>

      {/* Error display below expandable section */}
      {server.errors && server.errors.length > 0 && (
        <div className="mt-3 space-y-2">
          {server.errors.map((error, errorIndex) => (
            <Alert
              key={errorIndex}
              type="error"
              size="sm"
              className="cursor-pointer transition-all hover:underline"
              onClick={() =>
                void ideMessenger.ide.showVirtualFile(server.name, error)
              }
            >
              <span className="text-xs">
                {error.length > 150 ? error.substring(0, 150) + "..." : error}
              </span>
            </Alert>
          ))}
        </div>
      )}

      {server.infos && server.infos.length > 0 && (
        <div className="mt-3 space-y-2">
          {server.infos.map((info, infoIndex) => (
            <Alert
              key={infoIndex}
              type="info"
              size="sm"
              className="transition-all"
              onClick={() =>
                void ideMessenger.ide.showVirtualFile(server.name, info)
              }
            >
              <span
                className="text-xs"
                dangerouslySetInnerHTML={{ __html: info }}
              />
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}

export function ToolsSection() {
  const availableTools = useAppSelector((state) => state.config.config.tools);

  const currentOrg = useAppSelector(selectCurrentOrg);
  const mode = useAppSelector((store) => store.session.mode);
  const servers = useAppSelector(
    (store) => store.config.config.mcpServerStatuses,
  );
  const { selectedProfile } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);
  const disableMcp = currentOrg?.policy?.allowMcpServers === false;
  const isLocal = selectedProfile?.profileType === "local";

  const duplicateDetection = useMemo(() => {
    const counts: Record<string, number> = {};
    availableTools.forEach((tool) => {
      if (counts[tool.function.name]) {
        counts[tool.function.name] = counts[tool.function.name] + 1;
      } else {
        counts[tool.function.name] = 1;
      }
    });
    return Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [k, v > 1]),
    );
  }, [availableTools]);

  const mergedBlocks = useMemo(() => {
    const parsed = selectedProfile?.rawYaml
      ? parseConfigYaml(selectedProfile?.rawYaml ?? "")
      : undefined;

    // Create a map of YAML servers keyed by name for stable matching
    const yamlServersByName = new Map(
      parsed?.mcpServers
        ?.filter(
          (server): server is NonNullable<typeof server> & { name: string } =>
            server != null && "name" in server,
        )
        .map((server) => [server.name, server]) ?? [],
    );

    return (servers ?? []).map((doc: MCPServerStatus) => ({
      block: doc,
      blockFromYaml: yamlServersByName.get(doc.name),
    }));
  }, [servers, selectedProfile]);

  const handleAddMcpServer = () => {
    if (isLocal) {
      void ideMessenger.request("config/addLocalWorkspaceBlock", {
        blockType: "mcpServers",
      });
    } else {
      void ideMessenger.request("controlPlane/openUrl", {
        path: "?type=mcpServers",
        orgSlug: undefined,
      });
    }
  };

  const allToolsOff = useMemo(() => {
    return mode === "chat";
  }, [mode]);

  const availableToolsMessage =
    mode === "chat"
      ? "All tools disabled in Chat, switch to Plan or Agent mode to use tools"
      : mode === "plan"
        ? "Read-only tools available in Plan mode"
        : "";

  return (
    <>
      <ConfigHeader
        title="Tools"
        subtext="Manage MCP servers and tool policies"
        className="mb-2"
      />
      {!!availableToolsMessage && (
        <div className="mb-4">
          <Alert type="info" size="sm">
            <span className="text-2xs italic">{availableToolsMessage}</span>
          </Alert>
        </div>
      )}
      <div className="mb-4 space-y-6">
        <ToolPoliciesGroup
          showIcon={false}
          groupName={BUILT_IN_GROUP_NAME}
          displayName={"Built-in Tools"}
          allToolsOff={allToolsOff}
          duplicateDetection={duplicateDetection}
        />
        <ConfigHeader
          className="pr-2"
          title="MCP Servers"
          variant="sm"
          onAddClick={handleAddMcpServer}
          addButtonTooltip="Add MCP server"
          showAddButton={!disableMcp}
        />
        {disableMcp ? (
          <Card>
            <EmptyState message="MCP servers are disabled in your organization" />
          </Card>
        ) : (
          <>
            {mode === "chat" && (
              <Alert type="info" size="sm">
                <span className="text-2xs italic">
                  All MCPs are disabled in Chat, switch to Plan or Agent mode to
                  use MCPs
                </span>
              </Alert>
            )}
            {mergedBlocks.length > 0 ? (
              mergedBlocks.map(({ block, blockFromYaml }) => (
                <MCPServerPreview
                  key={block.name}
                  server={block}
                  serverFromYaml={blockFromYaml}
                  allToolsOff={allToolsOff}
                  duplicateDetection={duplicateDetection}
                />
              ))
            ) : (
              <Card>
                <EmptyState message="No MCP servers configured. Click the + button to add your first server." />
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
