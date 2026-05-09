import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { formatRelativeTimeAgo } from "core/util/format";
import { normalizeRepoUrl } from "core/util/repoUrl";
import { useContext, useEffect, useState } from "react";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppSelector } from "../../redux/hooks";
import { selectCurrentOrg } from "../../redux/slices/profilesSlice";
import { Button } from "../ui";

interface Agent {
  id: string;
  name: string | null;
  status: string;
  repoUrl: string;
  pullRequestUrl?: string | null;
  pullRequestStatus?: string | null;
  createdAt: string;
  metadata?: {
    github_repo?: string;
    source?: string;
    createdBySlug?: string;
    organizationId?: string;
  };
}

interface AgentsListProps {
  isCreatingAgent?: boolean;
  variant?: "full" | "compact";
}

interface WorkspaceInfo {
  repoUrl: string;
  workspaceDir: string;
  workspaceName: string;
}

export function AgentsList({
  isCreatingAgent = false,
  variant = "full",
}: AgentsListProps) {
  const { session } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);
  const currentOrg = useAppSelector(selectCurrentOrg);
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);

  useEffect(() => {
    async function fetchWorkspaceRepos() {
      if (!agents || agents.length === 0) {
        setWorkspaces([]);
        return;
      }

      const workspaceDirs = await ideMessenger.request(
        "getWorkspaceDirs",
        undefined,
      );

      if (workspaceDirs.status !== "success" || !workspaceDirs.content) {
        return;
      }

      const workspaceInfos: WorkspaceInfo[] = [];
      for (const dir of workspaceDirs.content) {
        try {
          const repoNameResult = await ideMessenger.request("getRepoName", {
            dir,
          });
          if (repoNameResult.status === "success" && repoNameResult.content) {
            const normalizedUrl = normalizeRepoUrl(repoNameResult.content);
            if (normalizedUrl) {
              const workspaceName = dir.split("/").pop() || dir;
              workspaceInfos.push({
                repoUrl: normalizedUrl,
                workspaceDir: dir,
                workspaceName,
              });
            }
          }
        } catch {
          // Some environments do not expose repository metadata.
        }
      }

      setWorkspaces(workspaceInfos);
    }

    void fetchWorkspaceRepos();
  }, [agents, ideMessenger]);

  useEffect(() => {
    async function fetchAgents() {
      if (!session) {
        setAgents([]);
        setTotalCount(0);
        return;
      }

      try {
        const organizationId =
          currentOrg?.id !== "personal" ? currentOrg?.id : undefined;
        const result = await ideMessenger.request("listBackgroundAgents", {
          organizationId,
          limit: 5,
        });

        if ("status" in result && result.status === "success") {
          const content = result.content as {
            agents: Agent[];
            totalCount: number;
          };
          setAgents(content.agents || []);
          setTotalCount(content.totalCount || 0);
          setError(null);
        } else if ("error" in result) {
          setError(result.error);
          setAgents([]);
          setTotalCount(0);
        } else {
          setAgents([]);
          setTotalCount(0);
        }
      } catch (err: any) {
        const errorMessage = err.message || "Failed to load agents";
        if (!isGitHubSetupError(errorMessage)) {
          console.error("Failed to fetch agents:", err);
        }
        setError(errorMessage);
        setAgents([]);
        setTotalCount(0);
      }
    }

    void fetchAgents();

    // Poll for updates every 10 seconds
    const interval = setInterval(() => {
      void fetchAgents();
    }, 10000);

    return () => clearInterval(interval);
  }, [session, ideMessenger, currentOrg, isCreatingAgent]);

  const getMatchingWorkspace = (agent: Agent): WorkspaceInfo | undefined => {
    // Get all possible agent repo URLs (both repoUrl and metadata.github_repo)
    const agentUrls = [agent.repoUrl, agent.metadata?.github_repo]
      .filter((url): url is string => Boolean(url))
      .map(normalizeRepoUrl)
      .filter((url) => url !== "");

    // Check if any of the agent URLs match any workspace URL
    return workspaces.find((workspace) =>
      agentUrls.some((agentUrl) => agentUrl === workspace.repoUrl),
    );
  };

  // Helper function to get the agent's repository name (for display in tooltips)
  const getAgentRepoName = (agent: Agent): string | null => {
    // Try to extract repo name from the agent's repository URL
    // Handles URLs like: https://github.com/org/repo or git@github.com:org/repo.git
    const repoUrl = agent.metadata?.github_repo || agent.repoUrl;
    if (!repoUrl) return null;

    try {
      // Remove .git suffix if present
      const cleanUrl = repoUrl.replace(/\.git$/, "");
      // Extract the last path segment (repo name)
      const parts = cleanUrl.split("/");
      const repoName = parts[parts.length - 1];
      return repoName || null;
    } catch {
      return null;
    }
  };

  const getTakeoverHint = (
    matchingWorkspace: WorkspaceInfo | undefined,
    agentRepoName: string | null,
  ): string => {
    if (matchingWorkspace) {
      return "Ready to take over in this workspace.";
    }

    if (agentRepoName) {
      return `Open ${agentRepoName} locally to take over.`;
    }

    return "Open the matching workspace locally to take over.";
  };

  const getAgentProvenanceParts = (agent: Agent): string[] => {
    const provenanceParts: string[] = [];

    if (agent.pullRequestStatus) {
      provenanceParts.push(`PR ${agent.pullRequestStatus}`);
    } else if (agent.pullRequestUrl) {
      provenanceParts.push("PR attached");
    }

    if (agent.metadata?.source) {
      provenanceParts.push(`Source ${agent.metadata.source}`);
    }

    if (agent.metadata?.createdBySlug) {
      provenanceParts.push(`By ${agent.metadata.createdBySlug}`);
    }

    return provenanceParts;
  };

  const isGitHubSetupError = (message: string | null): boolean => {
    return Boolean(
      message &&
        (message.includes("GitHub token") || message.includes("GitHub App")),
    );
  };

  const handleOpenAgentDetails = (
    agentId: string,
    event?: React.MouseEvent,
  ) => {
    event?.stopPropagation();
    ideMessenger.post("controlPlane/openUrl", {
      path: `agents/${agentId}`,
    });
  };

  const handleOpenLocally = (agent: Agent, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the agent detail page
    ideMessenger.post("openAgentLocally", { agentSessionId: agent.id });
  };

  const handleOpenGitHubSettings = () => {
    ideMessenger.post("controlPlane/openUrl", {
      path: "settings/integrations/github",
      orgSlug: currentOrg?.slug,
    });
  };

  if (error) {
    if (isGitHubSetupError(error)) {
      return (
        <div
          className="border-command-border bg-vsc-editor-background mx-2 rounded-xl border border-solid px-3 py-3"
          data-testid={
            variant === "compact"
              ? "background-inbox-panel"
              : "background-full-setup-panel"
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Background inbox</div>
              <div className="text-description-muted mt-1 text-xs">
                {variant === "compact"
                  ? "Connect GitHub to track cloud background tasks in this chat."
                  : "Connect GitHub to track cloud background tasks and take them over locally."}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              data-testid={
                variant === "compact"
                  ? "background-inbox-connect-github"
                  : "background-full-connect-github"
              }
              onClick={handleOpenGitHubSettings}
            >
              Connect GitHub
            </Button>
          </div>
        </div>
      );
    }

    if (variant === "compact") {
      return (
        <div
          className="border-command-border bg-vsc-editor-background mx-2 rounded-xl border border-solid px-3 py-3"
          data-testid="background-inbox-panel"
        >
          <div className="text-error text-sm">
            Error loading background tasks
          </div>
        </div>
      );
    }

    return (
      <div
        className="border-command-border bg-vsc-editor-background mx-2 rounded-xl border border-solid px-3 py-3"
        data-testid="background-full-error-panel"
      >
        <div className="text-sm font-semibold">Background inbox</div>
        <div className="text-error mt-1 text-sm">
          Error loading background tasks
        </div>
      </div>
    );
  }

  if (agents === null) {
    if (variant === "compact" && !isCreatingAgent) {
      return null;
    }

    return (
      <div
        className={
          variant === "compact"
            ? "border-command-border bg-vsc-editor-background mx-2 rounded-xl border border-solid px-3 py-3"
            : "border-command-border bg-vsc-editor-background mx-2 rounded-xl border border-solid px-3 py-3"
        }
        data-testid={
          variant === "compact"
            ? "background-inbox-panel"
            : "background-full-loading-panel"
        }
      >
        <div className="flex items-center gap-2">
          <ArrowPathIcon className="text-description-muted h-4 w-4 animate-spin" />
          {variant === "compact" ? (
            <span className="text-description-muted text-sm">
              Loading background tasks...
            </span>
          ) : (
            <div>
              <div className="text-sm font-medium">Background inbox</div>
              <div className="text-description-muted text-xs">
                Loading background tasks...
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    if (variant === "compact") {
      if (!isCreatingAgent) {
        return null;
      }

      return (
        <div
          className="border-command-border bg-vsc-editor-background mx-2 rounded-xl border border-solid px-3 py-3"
          data-testid="background-inbox-panel"
        >
          <div className="flex items-center gap-2">
            <ArrowPathIcon className="text-description-muted h-4 w-4 animate-spin" />
            <div>
              <div className="text-sm font-medium">Background inbox</div>
              <div className="text-description-muted text-xs">
                Creating your task. It will appear here shortly.
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className="border-command-border bg-vsc-editor-background mx-2 rounded-xl border border-solid px-3 py-3"
        data-testid="background-full-empty-panel"
      >
        <div className="text-sm font-semibold">Background inbox</div>
        <div className="text-description-muted mt-1 text-sm">
          No background tasks yet. Submit a message above to create one.
        </div>
      </div>
    );
  }

  const visibleAgents = variant === "compact" ? agents.slice(0, 3) : agents;
  const currentWorkspaceTaskCount = agents.filter((agent) =>
    Boolean(getMatchingWorkspace(agent)),
  ).length;
  const handoffTaskCount = Math.max(
    agents.length - currentWorkspaceTaskCount,
    0,
  );

  if (variant === "compact") {
    return (
      <div
        className="border-command-border bg-vsc-editor-background mx-2 rounded-xl border border-solid"
        data-testid="background-inbox-panel"
      >
        <div className="border-command-border flex items-start justify-between gap-3 border-0 border-b border-solid px-3 py-2">
          <div>
            <div className="text-sm font-semibold">Background inbox</div>
            <div className="text-description-muted text-[11px]">
              Track running agent tasks without leaving the current chat.
            </div>
          </div>
          <span className="bg-vsc-input-background text-description rounded-full px-2 py-0.5 text-[11px] font-medium">
            {totalCount} {totalCount === 1 ? "task" : "tasks"}
          </span>
        </div>

        <div className="flex flex-col gap-1 p-2">
          {visibleAgents.map((agent, index) => {
            const matchingWorkspace = getMatchingWorkspace(agent);
            const canOpenLocally = Boolean(matchingWorkspace);
            const agentRepoName = getAgentRepoName(agent);
            const repoLabel =
              agentRepoName || agent.metadata?.github_repo || agent.repoUrl;
            const takeoverHint = getTakeoverHint(
              matchingWorkspace,
              agentRepoName,
            );
            const provenanceParts = getAgentProvenanceParts(agent);

            return (
              <div
                key={agent.id}
                data-testid={`background-inbox-agent-${index}`}
                className="bg-vsc-input-background/60 hover:bg-vsc-input-background flex cursor-pointer items-start justify-between gap-3 rounded-lg px-3 py-2 transition-colors"
                onClick={() => handleOpenAgentDetails(agent.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="truncate text-sm font-medium">
                      {agent.name || "Unnamed Agent"}
                    </div>
                    <span className="bg-vsc-editor-background text-description-muted inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium">
                      Cloud task
                    </span>
                    <span
                      className={
                        canOpenLocally
                          ? "bg-vsc-editor-background text-description inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                          : "bg-vsc-editor-background text-warning inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                      }
                    >
                      {canOpenLocally ? "Current workspace" : "Other repo"}
                    </span>
                  </div>
                  <div className="text-description-muted mt-0.5 truncate text-[11px]">
                    {repoLabel}
                  </div>
                  {provenanceParts.length > 0 && (
                    <div
                      className="mt-1 flex flex-wrap items-center gap-1.5"
                      data-testid={`background-inbox-provenance-${index}`}
                    >
                      {provenanceParts.map((part) => (
                        <span
                          key={part}
                          className="bg-vsc-editor-background text-description-muted inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                        >
                          {part}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-description-muted mt-1 text-[11px]">
                    {takeoverHint} {formatAgentCreatedAt(agent.createdAt)}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="my-0 px-2 py-1 text-xs"
                      data-testid={`background-inbox-view-task-${index}`}
                      onClick={(event) =>
                        handleOpenAgentDetails(agent.id, event)
                      }
                    >
                      View task
                    </Button>
                    <Button
                      onClick={(event) =>
                        canOpenLocally && handleOpenLocally(agent, event)
                      }
                      disabled={!canOpenLocally}
                      variant="outline"
                      size="sm"
                      className="my-0 px-2 py-1 text-xs"
                      data-testid={`background-inbox-open-local-${index}`}
                      title={takeoverHint}
                    >
                      Open locally
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <AgentStatusBadge status={agent.status} />
                </div>
              </div>
            );
          })}

          {totalCount > visibleAgents.length && (
            <div className="pt-1">
              <Button
                onClick={() => {
                  ideMessenger.post("controlPlane/openUrl", {
                    path: "agents",
                  });
                }}
                variant="ghost"
                className="text-link my-0 w-full py-0 text-center text-sm font-medium hover:underline"
              >
                See all {totalCount} tasks →
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-2">
      <div
        className="border-command-border bg-vsc-editor-background rounded-xl border border-solid px-3 py-3"
        data-testid="background-full-summary"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Background inbox</div>
            <div className="text-description-muted mt-1 text-xs">
              Track cloud tasks for this workspace and take them over locally
              when you are ready.
            </div>
          </div>
          <span className="bg-vsc-input-background text-description rounded-full px-2 py-0.5 text-[11px] font-medium">
            {totalCount} {totalCount === 1 ? "task" : "tasks"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className="bg-vsc-input-background text-description rounded-full px-2 py-0.5 text-[11px] font-medium"
            data-testid="background-full-summary-workspace-count"
          >
            {currentWorkspaceTaskCount} ready here
          </span>
          {handoffTaskCount > 0 && (
            <span
              className="bg-vsc-input-background text-description rounded-full px-2 py-0.5 text-[11px] font-medium"
              data-testid="background-full-summary-handoff-count"
            >
              {handoffTaskCount} need repo handoff
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {visibleAgents.map((agent, index) => {
          const matchingWorkspace = getMatchingWorkspace(agent);
          const canOpenLocally = Boolean(matchingWorkspace);
          const agentRepoName = getAgentRepoName(agent);
          const repoLabel =
            agentRepoName || agent.metadata?.github_repo || agent.repoUrl;
          const takeoverHint = getTakeoverHint(
            matchingWorkspace,
            agentRepoName,
          );
          const provenanceParts = getAgentProvenanceParts(agent);

          return (
            <div
              key={agent.id}
              data-testid={`background-full-agent-${index}`}
              className="border-command-border bg-input cursor-pointer rounded-md border p-3 shadow-md transition-colors hover:brightness-110"
              onClick={() => handleOpenAgentDetails(agent.id)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="truncate text-sm font-medium">
                      {agent.name || "Unnamed Agent"}
                    </div>
                    <span className="bg-vsc-editor-background text-description-muted inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium">
                      Cloud task
                    </span>
                    <span
                      className={
                        canOpenLocally
                          ? "bg-vsc-editor-background text-description inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                          : "bg-vsc-editor-background text-warning inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                      }
                    >
                      {canOpenLocally ? "Current workspace" : "Other repo"}
                    </span>
                  </div>
                  <div className="text-description mt-0.5 truncate text-xs">
                    {repoLabel}
                  </div>
                  {provenanceParts.length > 0 && (
                    <div
                      className="mt-2 flex flex-wrap items-center gap-1.5"
                      data-testid={`background-full-provenance-${index}`}
                    >
                      {provenanceParts.map((part) => (
                        <span
                          key={part}
                          className="bg-vsc-editor-background text-description-muted inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                        >
                          {part}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-description-muted mt-2 text-xs">
                    {takeoverHint} {formatAgentCreatedAt(agent.createdAt)}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="my-0 px-2 py-1 text-xs"
                      data-testid={`background-full-view-task-${index}`}
                      onClick={(event) =>
                        handleOpenAgentDetails(agent.id, event)
                      }
                    >
                      View task
                    </Button>
                    <Button
                      onClick={(event) =>
                        canOpenLocally && handleOpenLocally(agent, event)
                      }
                      disabled={!canOpenLocally}
                      variant="outline"
                      size="sm"
                      className="my-0 px-2 py-1 text-xs"
                      data-testid={`background-full-open-local-${index}`}
                      title={takeoverHint}
                    >
                      Open locally
                    </Button>
                  </div>
                </div>
                <div className="ml-2 flex items-center gap-2">
                  <AgentStatusBadge status={agent.status} />
                </div>
              </div>
            </div>
          );
        })}
        {totalCount > agents.length && (
          <div className="mt-2">
            <Button
              onClick={() => {
                ideMessenger.post("controlPlane/openUrl", {
                  path: "agents",
                });
              }}
              variant="ghost"
              className="text-link my-0 w-full py-0 text-center text-sm font-medium hover:underline"
            >
              See all {totalCount} tasks →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentStatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    running: "border-success text-success",
    pending: "border-warning text-warning",
    creating: "border-info text-info",
    failure: "border-error text-error",
    suspended: "border-description text-description",
  };

  const color = statusColors[status] || "border-description text-description";

  return (
    <span
      className={`bg-badge inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {status}
    </span>
  );
}

function formatAgentCreatedAt(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return dateString;
  }
  return formatRelativeTimeAgo(date, { style: "narrow", numeric: "auto" });
}
