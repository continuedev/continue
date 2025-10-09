import { RocketLaunchIcon } from "@heroicons/react/24/outline";
import { useCallback, useState } from "react";
import { useAuth } from "../../context/Auth";
import { AgentsList } from "./AgentsList";

interface BackgroundModeViewProps {
  onCreateAgent: (prompt: string) => void;
}

export function BackgroundModeView({ onCreateAgent }: BackgroundModeViewProps) {
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
        <RocketLaunchIcon className="h-16 w-16 text-gray-400" />
        <div className="max-w-md text-center">
          <h3 className="mb-2 text-lg font-semibold">Background Agents</h3>
          <p className="mb-4 text-sm text-gray-600">
            Trigger long-running background agents that work on your codebase
            autonomously. Sign in to Continue to get started.
          </p>
          <button
            onClick={handleSignIn}
            disabled={isLoggingIn}
            className="rounded-lg bg-blue-500 px-6 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoggingIn ? "Signing in..." : "Sign In to Continue"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="px-2 text-sm text-gray-600">
        Agents you trigger will run in the background and appear below.
      </div>
      <AgentsList />
    </div>
  );
}
