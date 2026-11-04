import { MCPServerStatus } from "core";
import type { ApprovalCategoryName } from "core/tools/permissions/approval";
import ToggleSwitch from "../../../components/gui/Switch";
import { Card } from "../../../components/ui";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import {
  setApprovalCategory,
  setApprovalMcpServer,
} from "../../../redux/slices/uiSlice";

const CATEGORIES: {
  key: ApprovalCategoryName;
  label: string;
  hint: string;
}[] = [
  {
    key: "readFiles",
    label: "Read files",
    hint: "Read, list and search inside the workspace. Files outside it still ask.",
  },
  {
    key: "editFiles",
    label: "Edit files",
    hint: "Edit tools. Edits you review as a diff are still shown as a diff. Protected files (.git, .env, workflows) always ask.",
  },
  {
    key: "runSafeCommands",
    label: "Run safe commands",
    hint: "Commands the built-in safety check calls safe. Commands that touch protected paths still ask.",
  },
  {
    key: "runAllCommands",
    label: "Run all commands",
    hint: "Every command the safety check does not refuse, except those touching protected paths.",
  },
  {
    key: "browser",
    label: "Browser",
    hint: "Web search and fetching a URL.",
  },
  {
    key: "mcp",
    label: "MCP servers",
    hint: "Tools of every MCP server without its own switch below.",
  },
];

/**
 * Switches used by the Auto-approve and Auto approval modes. They sit on top of
 * the rules in config.yaml: a deny rule, an ask rule or a protected path wins
 * over any switch here.
 */
export function AutoApproveCard() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector((s) => s.ui.approvalMode);
  const categories = useAppSelector((s) => s.ui.approvalCategories);
  const perServer = useAppSelector((s) => s.ui.approvalMcpServers);
  const servers: MCPServerStatus[] = useAppSelector(
    (s) => s.config.config.mcpServerStatuses ?? [],
  );

  const inactive = mode === "manual" || mode === "yolo";

  return (
    <div data-testid="auto-approve-card">
      <h3 className="my-0 mb-1 text-sm font-semibold">Auto-approve</h3>
      <p className="mb-2 mt-0 text-xs text-description">
        {inactive
          ? "These switches take effect in Auto-approve and Auto approval modes. Pick one from the Approval menu next to the model."
          : "Tool calls in these categories run without asking. Deny rules, ask rules and protected paths always win."}
      </p>
      <Card>
        <div className="flex flex-col gap-2 py-1">
          {CATEGORIES.map(({ key, label, hint }) => (
            <div key={key} data-testid={`approve-category-${key}`}>
              <ToggleSwitch
                isToggled={!!categories[key]}
                onToggle={() =>
                  dispatch(
                    setApprovalCategory({
                      category: key,
                      enabled: !categories[key],
                    }),
                  )
                }
                text={label}
                size={10}
                tooltip={hint}
              />
            </div>
          ))}
          {servers.length > 0 && (
            <div className="mt-1 border-0 border-t border-solid border-command-border pt-2">
              <div className="mb-1 text-xs text-description">
                Per MCP server (overrides the MCP switch)
              </div>
              {servers.map((server) => {
                const own = perServer[server.name];
                return (
                  <div
                    key={server.id}
                    data-testid={`approve-mcp-${server.name}`}
                  >
                    <ToggleSwitch
                      isToggled={own ?? !!categories.mcp}
                      onToggle={() =>
                        dispatch(
                          setApprovalMcpServer({
                            server: server.name,
                            enabled: !(own ?? !!categories.mcp),
                          }),
                        )
                      }
                      text={server.name}
                      size={10}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
