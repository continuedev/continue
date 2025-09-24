import { ConfigYaml, parseConfigYaml } from "@continuedev/config-yaml";
import {
  ArrowPathIcon,
  ChevronDownIcon,
  CircleStackIcon,
  CommandLineIcon,
  EllipsisVerticalIcon,
  GlobeAltIcon,
  PlayCircleIcon,
  StopCircleIcon,
  UserCircleIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { MCPConnectionStatus, MCPServerStatus } from "core";
import { useContext, useEffect, useMemo, useState } from "react";
import Alert from "../../../components/gui/Alert";
import { ToolTip } from "../../../components/gui/Tooltip";
import EditBlockButton from "../../../components/mainInput/Lump/EditBlockButton";
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
import { ToolPolicies } from "../components/ToolPolicies";

interface MCPServerStatusProps {
  server: MCPServerStatus;
  serverFromYaml?: NonNullable<ConfigYaml["mcpServers"]>[number];
}

const ServerStatusTooltip: Record<MCPConnectionStatus, string> = {
  connected: "Active",
  connecting: "Connecting",
  "not-connected": "Inactive",
  authenticating: "Authenticating",
  error: "Error",
};

const ServerStatusColor: Record<MCPConnectionStatus, string> = {
  connected: "bg-success",
  connecting: "bg-warning",
  "not-connected": "bg-description-muted",
  authenticating: "bg-warning",
  error: "bg-error",
};

function MCPServerPreview({ server, serverFromYaml }: MCPServerStatusProps) {
  const [expandedSections, setExpandedSections] = useState<{
    [key: string]: boolean;
  }>({});
  const [disconnectedMCPServers, setDisconnectedMCPServers] = useState<
    string[]
  >([]);
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
    await ideMessenger.request("mcp/reloadServer", {
      id: server.id,
    });
    await fetchDisconectedMCPServers();
  };

  const onDisconnect = async () => {
    updateMCPServerStatus("not-connected");
    setDisconnectedMCPServers((prev) => [...prev, server.id]);
    dispatch(
      updateConfig({
        ...config,
        tools: config.tools.filter((tool) => tool.group !== server.id),
      }),
    );
    await ideMessenger.request("mcp/disconnectServer", {
      id: server.id,
    });
    await fetchDisconectedMCPServers();
  };

  const fetchDisconectedMCPServers = async () => {
    const disconnectedServersData = await ideMessenger.request(
      "mcp/getDisconnectedServers",
      undefined,
    );
    if (disconnectedServersData.status === "success") {
      setDisconnectedMCPServers(disconnectedServersData.content);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  useEffect(() => void fetchDisconectedMCPServers(), []);

  const ResourceRow = ({
    title,
    items,
    icon,
    sectionKey,
  }: {
    title: string;
    items:
      | MCPServerStatus["tools"]
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
          className="-mx-2 flex cursor-pointer items-center justify-between rounded px-2 py-2 hover:bg-gray-50 hover:bg-opacity-5"
          onClick={() => toggleSection(sectionKey)}
        >
          <div className="flex items-center gap-3">
            <ChevronDownIcon
              className={`text-description h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            />
            <div className="flex items-center gap-2">
              {icon}
              <span className="text-sm">{title}</span>
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-600 text-xs font-medium text-white">
                {items.length}
              </div>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="mb-3 ml-6 mt-2">
            {hasItems ? (
              <div className="space-y-1">
                {items.map((item, idx) => (
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
                ))}
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
    <div>
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

        <div className="-mr-2.5 flex items-center gap-1">
          {server.isProtectedResource && server.status !== "connected" && (
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
              >
                <EditBlockButton
                  blockType={"mcpServers"}
                  block={serverFromYaml}
                  sourceFile={server.sourceFile}
                  className="h-3.5 w-3.5 text-inherit"
                />
                Edit
              </ListboxOption>

              {!disconnectedMCPServers.includes(server.name) && (
                <ListboxOption
                  value="disconnect"
                  onClick={onDisconnect}
                  className="justify-start gap-x-1.5"
                >
                  <StopCircleIcon className="h-4 w-4 flex-shrink-0" />{" "}
                  Disconnect
                </ListboxOption>
              )}

              <ListboxOption
                value="reconnect"
                onClick={onRefresh}
                className="justify-start gap-x-1.5"
              >
                {disconnectedMCPServers.includes(server.name) ? (
                  <PlayCircleIcon className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <ArrowPathIcon className="h-4 w-4 flex-shrink-0" />
                )}
                Reload
              </ListboxOption>
            </ListboxOptions>
          </Listbox>
        </div>
      </div>

      {/* Individual resource rows */}
      <div className="mt-1">
        <ResourceRow
          title="Tools"
          items={server.tools}
          icon={
            <WrenchScrewdriverIcon className="text-description h-4 w-4 flex-shrink-0" />
          }
          sectionKey={`${server.id}-tools`}
        />

        <ResourceRow
          title="Prompts"
          items={server.prompts}
          icon={
            <CommandLineIcon className="text-description h-4 w-4 flex-shrink-0" />
          }
          sectionKey={`${server.id}-prompts`}
        />

        <ResourceRow
          title="Resources"
          items={[...server.resources, ...server.resourceTemplates]}
          icon={
            <CircleStackIcon className="text-description h-4 w-4 flex-shrink-0" />
          }
          sectionKey={`${server.id}-resources`}
        />
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

function McpSubsection() {
  const currentOrg = useAppSelector(selectCurrentOrg);
  const mode = useAppSelector((store) => store.session.mode);
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

  return (
    <div>
      <ConfigHeader
        title="MCP Servers"
        variant="sm"
        onAddClick={!disableMcp ? handleAddMcpServer : undefined}
        addButtonTooltip="Add MCP server"
      />
      {disableMcp ? (
        <Card>
          <EmptyState message="MCP servers are disabled in your organization" />
        </Card>
      ) : mode === "chat" ? (
        <Alert type="info" size="sm">
          <span className="text-2xs italic">
            All MCPs are disabled in Chat, switch to Plan or Agent mode to use
            MCPs
          </span>
        </Alert>
      ) : mergedBlocks.length > 0 ? (
        mergedBlocks.map(({ block, blockFromYaml }, index) => (
          <div key={block.id}>
            <Card>
              <MCPServerPreview server={block} serverFromYaml={blockFromYaml} />
            </Card>
            {index < mergedBlocks.length - 1 && <div className="mb-4" />}
          </div>
        ))
      ) : (
        <Card>
          <EmptyState message="No MCP servers configured. Click the + button to add your first server." />
        </Card>
      )}
    </div>
  );
}

function ToolPoliciesSubsection() {
  return (
    <div>
      <ConfigHeader title="Tool Policies" variant="sm" />
      <ToolPolicies />
    </div>
  );
}

export function ToolsSection() {
  const availableTools = useAppSelector((state) => state.config.config.tools);

  const hasTools = availableTools && availableTools.length > 0;

  return (
    <>
      <ConfigHeader title="Tools" />
      <div className="space-y-6">
        <McpSubsection />
        {hasTools && <ToolPoliciesSubsection />}
      </div>
    </>
  );
}
