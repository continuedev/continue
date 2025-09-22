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
import Alert from "../../../components/gui/Alert";
import { ToolTip } from "../../../components/gui/Tooltip";
import EditBlockButton from "../../../components/mainInput/Lump/EditBlockButton";
import { Button, Card, EmptyState } from "../../../components/ui";
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

function MCPServerPreview({ server, serverFromYaml }: MCPServerStatusProps) {
  const [expandedSections, setExpandedSections] = useState<{
    [key: string]: boolean;
  }>({});
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
    items: any[];
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
              <div
                className={`h-2 w-2 flex-shrink-0 rounded-full ${
                  server.status === "connected"
                    ? "bg-success"
                    : server.status === "connecting"
                      ? "bg-warning"
                      : server.status === "not-connected"
                        ? "bg-description-muted"
                        : "bg-error"
                }`}
              />
            </div>
          </div>
        </div>

        <div className="-mr-2.5 flex items-center gap-1">
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

          <ToolTip content="Edit server configuration">
            <div>
              <EditBlockButton
                blockType={"mcpServers"}
                block={serverFromYaml}
                sourceFile={server.sourceFile}
              />
            </div>
          </ToolTip>

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

    return (servers ?? []).map((doc) => ({
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
