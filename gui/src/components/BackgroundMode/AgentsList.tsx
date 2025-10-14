import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useContext, useEffect, useState } from "react";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppSelector } from "../../redux/hooks";
import { selectCurrentOrg } from "../../redux/slices/profilesSlice";

interface Agent {
  id: string;
  name: string | null;
  status: string;
  repoUrl: string;
  createdAt: string;
  metadata?: {
    github_repo?: string;
  };
}

interface AgentsListProps {
  isCreatingAgent?: boolean;
}

export function AgentsList({ isCreatingAgent = false }: AgentsListProps) {
  const { session } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);
  const currentOrg = useAppSelector(selectCurrentOrg);
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

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
        console.error("Failed to fetch agents:", err);
        setError(err.message || "Failed to load agents");
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
  }, [session, ideMessenger, currentOrg]);

  if (error) {
    return (
      <div className="text-error px-2 py-4 text-sm">
        Error loading agents: {error}
      </div>
    );
  }

  if (agents === null) {
    return (
      <div className="flex items-center justify-center py-8">
        <ArrowPathIcon className="text-description-muted h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-description-muted px-2 py-4 text-center text-sm">
        No background tasks yet. Submit a message above to create one.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-description-muted px-2 text-xs font-semibold">
        Background Tasks
      </div>
      <div className="flex flex-col gap-1 px-2">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="border-command-border bg-input cursor-pointer rounded-md border p-3 shadow-md transition-colors hover:brightness-110"
            onClick={() => {
              // Open agent detail in browser
              ideMessenger.post("controlPlane/openUrl", {
                path: `agents/${agent.id}`,
                orgSlug: currentOrg?.slug,
              });
            }}
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {agent.name || "Unnamed Agent"}
                </div>
                <div className="text-description mt-0.5 truncate text-xs">
                  {agent.metadata?.github_repo || agent.repoUrl}
                </div>
              </div>
              <div className="ml-2">
                <AgentStatusBadge status={agent.status} />
              </div>
            </div>
            <div className="text-description-muted mt-1 text-xs">
              {formatRelativeTime(agent.createdAt)}
            </div>
          </div>
        ))}
        {totalCount > agents.length && (
          <div className="mt-2">
            <button
              onClick={() => {
                ideMessenger.post("controlPlane/openUrl", {
                  path: "agents",
                  orgSlug: currentOrg?.slug,
                });
              }}
              className="text-link w-full cursor-pointer border-none bg-transparent p-0 text-center text-sm font-medium no-underline hover:underline"
            >
              See all {totalCount} tasks →
            </button>
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

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return "just now";
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  } catch {
    return dateString;
  }
}
