import { ConfigYaml, parseConfigYaml } from "@continuedev/config-yaml";
import {
  ArrowPathIcon,
  CircleStackIcon,
  CommandLineIcon,
  GlobeAltIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { MCPServerStatus } from "core";
import { Fragment, useContext, useMemo } from "react";
import { useAuth } from "../../../../../context/Auth";
import { IdeMessengerContext } from "../../../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../../../redux/hooks";
import { updateConfig } from "../../../../../redux/slices/configSlice";
import { fontSize } from "../../../../../util";
import { ToolTip } from "../../../../gui/Tooltip";
import { Button } from "../../../../ui";
import EditBlockButton from "../../EditBlockButton";
import { ExploreBlocksButton } from "../ExploreBlocksButton";

interface MCPServerStatusProps {
  server: MCPServerStatus;
  serverFromYaml?: NonNullable<ConfigYaml["mcpServers"]>[number];
}
function MCPServerPreview({ server, serverFromYaml }: MCPServerStatusProps) {
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

  return (
    <div
      style={{
        fontSize: fontSize(-2),
      }}
      className={`flex flex-row items-center justify-between gap-3 ${server.status === "authenticating" ? "my-0.5" : ""}`}
    >
      <div className="flex flex-row items-center gap-3">
        {/* Name and Status */}
        <span className="m-0 font-semibold">{server.name}</span>

        {/* Error indicator if any */}
        {server.errors.length ? (
          <ToolTip
            clickable
            delayHide={
              server.errors.some((error) => error.length > 150) ? 1500 : 0
            }
            className="flex flex-col gap-0.5"
            content={server.errors.map((error, idx) => (
              <Fragment key={idx}>
                <div>
                  {error.length > 150 ? error.substring(0, 150) + "..." : error}
                </div>
                {error.length > 150 && (
                  <Button
                    className="my-0"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void ideMessenger.ide.showVirtualFile(server.name, error)
                    }
                  >
                    View full error
                  </Button>
                )}
              </Fragment>
            ))}
          >
            <InformationCircleIcon
              className={`h-3 w-3 ${server.status === "error" ? "text-red-500" : "text-yellow-500"}`}
            />
          </ToolTip>
        ) : null}

        {/* Tools, Prompts, Resources with counts */}
        <div className="flex flex-row items-center gap-3">
          <ToolTip
            className="flex flex-col gap-0.5"
            content={
              <>
                {server.tools.map((tool, idx) => (
                  <code key={idx}>{tool.name}</code>
                ))}
                {server.tools.length === 0 && (
                  <span className="text-lightgray">No tools</span>
                )}
              </>
            }
          >
            <div className="flex cursor-zoom-in items-center gap-1 hover:opacity-80">
              <WrenchScrewdriverIcon className="h-3 w-3" />
              <span className="text-xs">{server.tools.length}</span>
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
            <div className="flex cursor-zoom-in items-center gap-1 hover:opacity-80">
              <CommandLineIcon className="h-3 w-3" />
              <span className="text-xs">{server.prompts.length}</span>
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
            <div className="flex cursor-zoom-in items-center gap-1 hover:opacity-80">
              <CircleStackIcon className="h-3 w-3" />
              <span className="text-xs">
                {server.resources.length + server.resourceTemplates.length}
              </span>
            </div>
          </ToolTip>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {server.isProtectedResource && (
          <ToolTip
            place="left"
            hidden={server.status === "authenticating"}
            content={server.status === "error" ? "Authenticate" : "Logout"}
          >
            <div className="text-lightgray flex cursor-pointer items-center hover:text-white hover:opacity-80">
              {server.status === "error" ? (
                <ShieldExclamationIcon
                  className="h-3 w-3"
                  onClick={onAuthenticate}
                />
              ) : server.status === "authenticating" ? (
                <GlobeAltIcon className="animate-spin-slow h-3 w-3" />
              ) : (
                <ShieldCheckIcon className="h-3 w-3" onClick={onRemoveAuth} />
              )}
            </div>
          </ToolTip>
        )}
        <EditBlockButton
          blockType={"mcpServers"}
          block={serverFromYaml}
          sourceFile={server.sourceFile}
        />
        <div
          className="text-lightgray flex cursor-pointer items-center hover:opacity-80"
          onClick={onRefresh}
        >
          <ArrowPathIcon className="h-3 w-3" />
        </div>

        <div
          className="hidden h-2 w-2 rounded-full sm:flex"
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
  );
}

function MCPSection() {
  const servers = useAppSelector(
    (store) => store.config.config.mcpServerStatuses,
  );
  const { selectedProfile } = useAuth();

  const mergedBlocks = useMemo(() => {
    const parsed = selectedProfile?.rawYaml
      ? parseConfigYaml(selectedProfile?.rawYaml ?? "")
      : undefined;
    return (servers ?? []).map((doc, index) => ({
      block: doc,
      blockFromYaml: parsed?.mcpServers?.[index],
    }));
  }, [servers, selectedProfile]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex max-h-[170px] flex-col gap-1 overflow-y-auto overflow-x-hidden pr-2">
        {mergedBlocks.map(({ block, blockFromYaml }, idx) => (
          <MCPServerPreview
            key={idx}
            server={block}
            serverFromYaml={blockFromYaml}
          />
        ))}
      </div>
      <ExploreBlocksButton blockType="mcpServers" />
    </div>
  );
}

export default MCPSection;
