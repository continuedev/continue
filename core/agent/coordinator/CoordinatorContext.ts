import path from "node:path";

const MAX_COORDINATOR_SCRATCHPAD_CHARS = 4000;

export function getCoordinatorScratchpadPath(
  continueHome: string,
  parentSessionId: string,
): string {
  return path.join(
    continueHome,
    "coordinator",
    parentSessionId,
    "WORKER_SCRATCHPAD.md",
  );
}

export function buildCoordinatorWorkerSystemMessage({
  scratchpadPath,
  scratchpadContent,
}: {
  scratchpadPath: string;
  scratchpadContent: string;
}): string {
  const trimmed = scratchpadContent.trim();
  const wasTrimmed = trimmed.length > MAX_COORDINATOR_SCRATCHPAD_CHARS;
  const visibleScratchpad = wasTrimmed
    ? trimmed.slice(-MAX_COORDINATOR_SCRATCHPAD_CHARS)
    : trimmed;

  const instructions = [
    "You are running as a coordinator-managed worker.",
    `Shared scratchpad path: ${scratchpadPath}`,
    "Read it for prior worker findings and append concise updates that will help the coordinator or later workers.",
  ].join("\n");

  if (!visibleScratchpad) {
    return `${instructions}\n\nThe shared scratchpad is currently empty.`;
  }

  const scratchpadNotice = wasTrimmed
    ? "Current scratchpad contents (truncated to the most recent section):"
    : "Current scratchpad contents:";

  return `${instructions}\n\n${scratchpadNotice}\n\n${visibleScratchpad}`;
}
