import { ConfigYaml, parseConfigYaml } from "@continuedev/config-yaml";
import {
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleStackIcon,
  CommandLineIcon,
  GlobeAltIcon,
  InformationCircleIcon,
  PlusCircleIcon,
  UserCircleIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { MCPServerStatus, MessageModes, Tool } from "core";
import { BUILT_IN_GROUP_NAME } from "core/tools/builtIn";
import { useContext, useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { Tooltip } from "react-tooltip";
import Alert from "../../../components/gui/Alert";
import ToggleSwitch from "../../../components/gui/Switch";
import { ToolTip } from "../../../components/gui/Tooltip";
import EditBlockButton from "../../../components/mainInput/Lump/EditBlockButton";
import { Button, Card, EmptyState, Listbox, ListboxButton, ListboxOption, ListboxOptions } from "../../../components/ui";
import { useFontSize } from "../../../components/ui/font";
import { useAuth } from "../../../context/Auth";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { updateConfig } from "../../../redux/slices/configSlice";
import { selectCurrentOrg } from "../../../redux/slices/profilesSlice";
import {
  addTool,
  toggleToolGroupSetting,
  toggleToolSetting,
} from "../../../redux/slices/uiSlice";
import { fontSize } from "../../../util";
import { ConfigHeader } from "../ConfigHeader";

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
                className="my-0 h-8 w-8 p-0"
                disabled={server.status === "authenticating"}
              >
                {server.status === "authenticating" ? (
                  <GlobeAltIcon className="animate-spin-slow text-description h-4 w-4" />
                ) : (
                  <UserCircleIcon className="text-description h-4 w-4" />
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
              className="my-0 h-8 w-8 p-0"
            >
              <ArrowPathIcon className="text-description h-4 w-4" />
            </Button>
          </ToolTip>
        </div>
      </div>

      {/* Individual resource rows */}
      <div className="mt-1">
        <ResourceRow
          title="Tools"
          items={server.tools}
          icon={<WrenchScrewdriverIcon className="text-description h-4 w-4" />}
          sectionKey={`${server.id}-tools`}
        />

        <ResourceRow
          title="Prompts"
          items={server.prompts}
          icon={<CommandLineIcon className="text-description h-4 w-4" />}
          sectionKey={`${server.id}-prompts`}
        />

        <ResourceRow
          title="Resources"
          items={[...server.resources, ...server.resourceTemplates]}
          icon={<CircleStackIcon className="text-description h-4 w-4" />}
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
    </div>
  );
}

interface ToolDropdownItemProps {
  tool: Tool;
  duplicatesDetected: boolean;
  isGroupEnabled: boolean;
}

function ToolPolicyItem(props: ToolDropdownItemProps) {
  const dispatch = useDispatch();
  const policy = useAppSelector(
    (state) => state.ui.toolSettings[props.tool.function.name],
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const mode = useAppSelector((state) => state.session.mode);

  useEffect(() => {
    if (!policy) {
      dispatch(addTool(props.tool));
    }
  }, [props.tool.function.name, policy]);

  const parameters = useMemo(() => {
    if (props.tool.function.parameters?.properties) {
      return Object.entries(props.tool.function.parameters.properties).map(
        ([name, schema]) =>
          [name, schema] as [string, { description: string; type: string }],
      );
    }
    return undefined;
  }, [props.tool.function.parameters]);

  const fontSize = useFontSize(-2);

  const disabled =
    !props.isGroupEnabled ||
    (mode === "plan" &&
      props.tool.group === BUILT_IN_GROUP_NAME &&
      !props.tool.readonly);

  if (!policy) {
    return null;
  }
  const disabledTooltipId = `disabled-note-${props.tool.function.name}`;

  return (
    <div
      className="flex flex-col"
      style={{
        fontSize,
      }}
    >
      <div
        className="-mx-2 flex flex-col rounded px-2 py-2 hover:bg-gray-50 hover:bg-opacity-5"
      >
        <div className="flex flex-row items-start justify-between">
          <div
            className="flex flex-1 cursor-pointer flex-row items-start gap-1"
            onClick={() => setIsExpanded((val) => !val)}
          >
            <ChevronRightIcon
              className={`mt-0.5 xs:flex hidden h-3 w-3 flex-shrink-0 transition-all duration-200 ${isExpanded ? "rotate-90" : ""}`}
            />

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                {props.duplicatesDetected ? (
                  <ToolTip
                    place="bottom"
                    className="flex flex-wrap items-center"
                    content={
                      <p className="m-0 p-0">
                        <span>Duplicate tool name</span>{" "}
                        <code>{props.tool.function.name}</code>{" "}
                        <span>
                          detected. Permissions will conflict and usage may be
                          unpredictable
                        </span>
                      </p>
                    }
                  >
                    <InformationCircleIcon className="h-3 w-3 flex-shrink-0 cursor-help text-yellow-500" />
                  </ToolTip>
                ) : null}
                {props.tool.faviconUrl && (
                  <img
                    src={props.tool.faviconUrl}
                    alt={props.tool.displayTitle}
                    className="h-3 w-3 flex-shrink-0"
                  />
                )}
                <span 
                  className="line-clamp-1 break-all text-sm"
                >
                  {props.tool.originalFunctionName ?? props.tool.function.name}
                </span>
              </div>
              <div className="text-sm text-description line-clamp-3">
                {props.tool.function.description}
              </div>
            </div>
          </div>

          <div className="flex w-20 justify-end sm:w-24">
            <Listbox
              value={disabled || policy === "disabled" ? "disabled" : policy}
              onChange={(newPolicy) => {
                if (!disabled && newPolicy !== policy) {
                  dispatch(toggleToolSetting(props.tool.function.name));
                }
              }}
              disabled={disabled}
            >
              <div className="relative">
                <ListboxButton
                  className={`h-7 w-full justify-between px-3 ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                  data-testid={`tool-policy-item-${props.tool.function.name}`}
                  data-tooltip-id={disabled ? disabledTooltipId : undefined}
                >
                  <span className="text-xs">
                    {disabled || policy === "disabled"
                      ? "Excluded"
                      : policy === "allowedWithoutPermission"
                        ? "Automatic"
                        : "Ask First"}
                  </span>
                  <ChevronDownIcon className="h-3 w-3" />
                </ListboxButton>
                {!disabled && (
                  <ListboxOptions className="min-w-0">
                    <ListboxOption value="allowedWithoutPermission">
                      Automatic
                    </ListboxOption>
                    <ListboxOption value="allowedWithPermission">
                      Ask First
                    </ListboxOption>
                    <ListboxOption value="disabled">
                      Excluded
                    </ListboxOption>
                  </ListboxOptions>
                )}
              </div>
            </Listbox>
          </div>
        </div>
        <Tooltip id={disabledTooltipId}>
          {mode === "chat"
            ? "Tool disabled in chat mode"
            : !props.isGroupEnabled
              ? "Group is turned off"
              : "Tool disabled in plan mode"}
        </Tooltip>
      </div>
      <div
        className={`flex flex-col overflow-hidden ${isExpanded ? "h-min" : "h-0 opacity-0"} gap-x-1 gap-y-2 pl-2 transition-all`}
      >
        <span className="mt-1.5 text-2xs font-bold">Description:</span>
        <span className="italic text-2xs">{props.tool.function.description}</span>
        {parameters ? (
          <>
            <span className="text-2xs font-bold">Arguments:</span>
            {parameters.map((param, idx) => (
              <div key={idx} className="block text-2xs">
                <code className="">{param[0]}</code>
                <span className="ml-1">{`(${param[1].type}):`}</span>
                <span className="ml-1 italic">{param[1].description}</span>
              </div>
            ))}
          </>
        ) : null}
        <div className="h-1"></div>
      </div>
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
        path: "?type=mcpServers",
        orgSlug: undefined,
      });
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">MCP Servers</h3>
        {!disableMcp && (
          <Button
            onClick={handleAddMcpServer}
            variant="ghost"
            size="sm"
            className="my-0 h-8 w-8 p-0"
          >
            <PlusCircleIcon className="text-description h-5 w-5" />
          </Button>
        )}
      </div>
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
  const mode = useAppSelector((state) => state.session.mode);
  const availableTools = useAppSelector((state) => state.config.config.tools);
  const toolGroupSettings = useAppSelector(
    (store) => store.ui.toolGroupSettings,
  );
  const dispatch = useAppDispatch();
  const [expandedGroups, setExpandedGroups] = useState<{
    [key: string]: boolean;
  }>({});

  const toolsByGroup = useMemo(() => {
    const byGroup: Record<string, Tool[]> = {};
    for (const tool of availableTools) {
      if (!byGroup[tool.group]) {
        byGroup[tool.group] = [];
      }
      byGroup[tool.group].push(tool);
    }
    return Object.entries(byGroup);
  }, [availableTools]);

  // Detect duplicate tool names
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

  const allToolsOff = mode === "chat";

  const getMessage = (mode: MessageModes) => {
    switch (mode) {
      case "chat":
        return "All tools disabled in Chat, switch to Plan or Agent mode to use tools";
      case "plan":
        return "Read-only/MCP tools available in Plan mode";
      default:
        return "";
    }
  };

  const message = getMessage(mode);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  if (toolsByGroup.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Tool Policies</h3>

      {(mode === "chat" || mode === "plan") && (
        <div className="mb-4">
          <Alert type="info" size="sm">
            <span className="text-2xs italic">{message}</span>
          </Alert>
        </div>
      )}

      <div className="space-y-4">
        {toolsByGroup.map(([groupName, tools]) => {
          const isGroupEnabled =
            !allToolsOff && toolGroupSettings[groupName] !== "exclude";
          const isExpanded = expandedGroups[groupName];

          return (
            <Card key={groupName}>
              <div className="flex flex-col">
                <div className="flex items-center justify-between">
                  <div
                    className="-mx-2 flex flex-1 cursor-pointer items-center gap-3 rounded px-2 py-2 hover:bg-gray-50 hover:bg-opacity-5"
                    onClick={() => toggleGroup(groupName)}
                  >
                    <ChevronDownIcon
                      className={`text-description h-3 w-3 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{groupName}</span>
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-600 text-xs font-medium text-white">
                        {tools.length}
                      </div>
                    </div>
                  </div>
                  <ToolTip
                    content={
                      allToolsOff
                        ? "Tools disabled in current mode"
                        : isGroupEnabled
                          ? `Disable all tools in ${groupName} group`
                          : `Enable all tools in ${groupName} group`
                    }
                  >
                    <div>
                      <ToggleSwitch
                        isToggled={isGroupEnabled}
                        onToggle={() => dispatch(toggleToolGroupSetting(groupName))}
                        text=""
                        size={10}
                        disabled={allToolsOff}
                      />
                    </div>
                  </ToolTip>
                </div>

                {isExpanded && (
                  <div className="mt-3 space-y-1">
                    {tools.map((tool) => (
                      <ToolPolicyItem
                        key={tool.uri + tool.function.name}
                        tool={tool}
                        duplicatesDetected={duplicateDetection[tool.function.name]}
                        isGroupEnabled={isGroupEnabled}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function ToolsSection() {
  const availableTools = useAppSelector((state) => state.config.config.tools);

  const hasTools = availableTools && availableTools.length > 0;

  return (
    <div>
      <ConfigHeader title="Tools" />
      <div className="space-y-8">
        <McpSubsection />
        {hasTools && <ToolPoliciesSubsection />}
      </div>
    </div>
  );
}
