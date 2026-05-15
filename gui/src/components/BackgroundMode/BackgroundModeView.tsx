import { ArrowPathIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";
import { useCallback, useState } from "react";
import { useAuth } from "../../context/Auth";
import { AgentsList } from "./AgentsList";

interface BackgroundModeViewProps {
  isCreatingAgent?: boolean;
}

export function BackgroundModeView({
  isCreatingAgent = false,
}: BackgroundModeViewProps) {
  const { session, login } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSignIn = useCallback(async () => {
    setIsLoggingIn(true);
    try {
      await login(false);
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setIsLoggingIn(false);
    }
  }, [login]);

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-4 py-8">
        <RocketLaunchIcon className="text-description-muted h-16 w-16" />
        <div className="max-w-md text-center">
          <h3 className="mb-2 text-lg font-semibold">Background Agents</h3>
          <p className="text-description mb-4 text-sm">
            Trigger long-running background agents that work on your codebase
            autonomously. Sign in to Yuto Hub to get started.
          </p>
          <button
            onClick={handleSignIn}
            disabled={isLoggingIn}
            className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-lg px-6 py-2 disabled:opacity-50"
          >
            {isLoggingIn ? "Signing in..." : "Sign In to Yuto Hub"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="px-2">
        <div className="text-description text-sm">
          Submit a task above to run a background agent. Your task will appear
          below in ~30 seconds once the container starts.
        </div>
        {isCreatingAgent && (
          <div className="text-description-muted mt-2 flex items-center gap-2 text-xs">
            <ArrowPathIcon className="h-3 w-3 animate-spin" />
            <span>Creating task...</span>
          </div>
        )}
      </div>
      <AgentsList isCreatingAgent={isCreatingAgent} />
    </div>
  );
}
