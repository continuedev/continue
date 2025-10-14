import { useEffect, useState } from "react";

import { getGitBranch } from "../../util/git.js";

/**
 * Custom hook to watch for git branch changes
 * @param pollInterval Interval in milliseconds to check for branch changes (default: 1000ms)
 * @returns The current git branch name or null if not in a git repo
 */
export function useGitBranch(pollInterval: number = 1000): string | null {
  const [branch, setBranch] = useState<string | null>(() => getGitBranch());

  useEffect(() => {
    // Poll for branch changes
    const intervalId = setInterval(() => {
      const currentBranch = getGitBranch();
      setBranch((prevBranch) => {
        // Only update if branch has changed to avoid unnecessary re-renders
        if (currentBranch !== prevBranch) {
          return currentBranch;
        }
        return prevBranch;
      });
    }, pollInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [pollInterval]);

  return branch;
}
