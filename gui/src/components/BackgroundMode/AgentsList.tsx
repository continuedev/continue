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

export function AgentsList() {
  const { session } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);
  const currentOrg = useAppSelector(selectCurrentOrg);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgents() {
      if (!session) {
        setAgents([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        // Request agent list from IDE
        const organizationId =
          currentOrg?.id !== "personal" ? currentOrg?.id : undefined;
        const result = await ideMessenger.request("listBackgroundAgents", {
          organizationId,
        });

        // Handle wrapped response format
        if ("status" in result && result.status === "success") {
          if (Array.isArray(result.content)) {
            setAgents(result.content);
            setError(null);
          } else {
            setAgents([]);
          }
        } else if ("error" in result) {
          setError(result.error);
          setAgents([]);
        } else {
          setAgents([]);
        }
      } catch (err: any) {
        console.error("Failed to fetch agents:", err);
        setError(err.message || "Failed to load agents");
        setAgents([]);
      } finally {
        setIsLoading(false);
      }
    }

    void fetchAgents();

    // Poll for updates every 10 seconds
    const interval = setInterval(() => {
      void fetchAgents();
    }, 10000);

    return () => clearInterval(interval);
  }, [session, ideMessenger, currentOrg]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-2 py-4 text-sm text-red-500">
        Error loading agents: {error}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="px-2 py-4 text-center text-sm text-gray-500">
        No background agents yet. Submit a message above to create one.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="px-2 text-xs font-semibold text-gray-500">
        Recent Agents
      </div>
      <div className="flex flex-col gap-1">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 p-3 transition-colors hover:bg-gray-100"
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
                <div className="truncate text-sm font-medium text-gray-900">
                  {agent.name || "Unnamed Agent"}
                </div>
                <div className="mt-0.5 truncate text-xs text-gray-500">
                  {agent.metadata?.github_repo || agent.repoUrl}
                </div>
              </div>
              <div className="ml-2">
                <AgentStatusBadge status={agent.status} />
              </div>
            </div>
            <div className="mt-1 text-xs text-gray-400">
              {formatRelativeTime(agent.createdAt)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentStatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    running: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    creating: "bg-blue-100 text-blue-800",
    failure: "bg-red-100 text-red-800",
    suspended: "bg-gray-100 text-gray-800",
  };

  const color = statusColors[status] || "bg-gray-100 text-gray-800";

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${color}`}
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
