import * as fs from "fs/promises";
import * as path from "path";

import type { ToolExtras } from "..";

import { getContinueGlobalPath } from "./paths";

function getSessionScopedDir(namespace: string): string {
  return path.join(getContinueGlobalPath(), "agent-state", namespace);
}

async function ensureSessionScopedDir(namespace: string): Promise<string> {
  const dir = getSessionScopedDir(namespace);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  return dir;
}

export function getToolSessionId(
  extras: Pick<ToolExtras, "sessionId">,
): string | null {
  const sessionId = extras.sessionId?.trim();
  return sessionId ? sessionId : null;
}

export async function getSessionScopedStatePath(
  namespace: string,
  sessionId: string,
): Promise<string> {
  const dir = await ensureSessionScopedDir(namespace);
  return path.join(dir, `${sessionId}.json`);
}

export async function loadSessionScopedJsonState<T>(
  namespace: string,
  sessionId: string,
  fallback: T,
): Promise<T> {
  try {
    const filePath = await getSessionScopedStatePath(namespace, sessionId);
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

export async function saveSessionScopedJsonState<T>(
  namespace: string,
  sessionId: string,
  state: T,
): Promise<void> {
  const filePath = await getSessionScopedStatePath(namespace, sessionId);
  await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

export async function deleteSessionScopedJsonState(
  namespace: string,
  sessionId: string,
): Promise<void> {
  const filePath = await getSessionScopedStatePath(namespace, sessionId);
  await fs.rm(filePath, { force: true });
}
