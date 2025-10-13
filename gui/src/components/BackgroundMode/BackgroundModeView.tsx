import {
  ExclamationTriangleIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { AgentsList } from "./AgentsList";

interface BackgroundModeViewProps {
  onCreateAgent: (editorState: any) => void;
}

export function BackgroundModeView({ onCreateAgent }: BackgroundModeViewProps) {
  const { session, login } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showGitHubSetup, setShowGitHubSetup] = useState(false);
  const [checkingGitHub, setCheckingGitHub] = useState(true);

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

  const handleOpenGitHubSettings = useCallback(() => {
    // Open the hub settings page for GitHub integration
    ideMessenger.post(
      "openUrl",
      "https://hub.continue.dev/settings/integrations/github",
    );
  }, [ideMessenger]);

  // Check if user has GitHub installations when signed in
  useEffect(() => {
    async function checkGitHubAuth() {
      if (!session) {
        setCheckingGitHub(false);
        return;
      }

      try {
        setCheckingGitHub(true);
        // Try to list agents - if this fails with GitHub token error,
        // we know GitHub isn't connected
        const result = await ideMessenger.request("listBackgroundAgents", {});

        // Check for error response
        if ("error" in result) {
          // Check if error is related to GitHub token
          if (
            result.error?.includes("GitHub token") ||
            result.error?.includes("GitHub App")
          ) {
            setShowGitHubSetup(true);
          }
        } else {
          // If we got here without error, GitHub is connected
          setShowGitHubSetup(false);
        }
      } catch (error: any) {
        // Check if error is related to GitHub token
        if (
          error?.message?.includes("GitHub token") ||
          error?.message?.includes("GitHub App")
        ) {
          setShowGitHubSetup(true);
        }
      } finally {
        setCheckingGitHub(false);
      }
    }

    void checkGitHubAuth();
  }, [session, ideMessenger]);

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
      {!checkingGitHub && showGitHubSetup && (
        <div className="mx-2 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 text-yellow-600" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-yellow-900">
                Connect GitHub
              </h4>
              <p className="mt-1 text-sm text-yellow-800">
                Background agents need access to your GitHub repositories.
                Connect your GitHub account to get started.
              </p>
              <button
                onClick={handleOpenGitHubSettings}
                className="mt-3 rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
              >
                Connect GitHub Account
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="px-2 text-sm text-gray-600">
        Agents you trigger will run in the background and appear below.
      </div>
      <AgentsList />
    </div>
  );
}
