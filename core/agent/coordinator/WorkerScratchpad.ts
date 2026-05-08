import fs from "node:fs/promises";
import path from "node:path";

function buildInitialScratchpad(parentSessionId: string): string {
  return [
    "# Coordinator Scratchpad",
    "",
    `Parent session: ${parentSessionId}`,
    "",
    "Use this file to share concise findings, constraints, and follow-up tasks across coordinator workers.",
  ].join("\n");
}

export async function ensureWorkerScratchpad(
  scratchpadPath: string,
  parentSessionId: string,
): Promise<void> {
  await fs.mkdir(path.dirname(scratchpadPath), { recursive: true });

  try {
    await fs.access(scratchpadPath);
  } catch {
    await fs.writeFile(
      scratchpadPath,
      buildInitialScratchpad(parentSessionId),
      "utf8",
    );
  }
}

export async function readWorkerScratchpad(
  scratchpadPath: string,
  parentSessionId: string,
): Promise<string> {
  await ensureWorkerScratchpad(scratchpadPath, parentSessionId);
  return fs.readFile(scratchpadPath, "utf8");
}

export async function appendWorkerScratchpadEntry(
  scratchpadPath: string,
  parentSessionId: string,
  entry: {
    agentName: string;
    prompt: string;
    response: string;
    success: boolean;
    profile?: string;
  },
): Promise<void> {
  await ensureWorkerScratchpad(scratchpadPath, parentSessionId);

  const timestamp = new Date().toISOString();
  const lines = [
    "",
    "",
    `## ${timestamp} | ${entry.agentName}`,
    `Status: ${entry.success ? "completed" : "failed"}`,
  ];

  if (entry.profile) {
    lines.push(`Profile: ${entry.profile}`);
  }

  lines.push(
    "",
    "Task:",
    entry.prompt.trim() || "(no task provided)",
    "",
    "Summary:",
    entry.response.trim() || "(no final response)",
  );

  await fs.appendFile(scratchpadPath, lines.join("\n"), "utf8");
}
