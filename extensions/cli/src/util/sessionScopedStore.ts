import fs from "fs/promises";
import path from "path";

import { env } from "../env.js";
import { getCurrentSession } from "../session.js";

function getSessionScopedDir(namespace: string): string {
  return path.join(env.continueHome, "agent-state", namespace);
}

async function ensureSessionScopedDir(namespace: string): Promise<string> {
  const dir = getSessionScopedDir(namespace);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function getSessionScopedStatePath(
  namespace: string,
): Promise<string> {
  const dir = await ensureSessionScopedDir(namespace);
  const sessionId = getCurrentSession().sessionId;
  return path.join(dir, `${sessionId}.json`);
}

export async function loadSessionScopedJsonState<T>(
  namespace: string,
  fallback: T,
): Promise<T> {
  try {
    const filePath = await getSessionScopedStatePath(namespace);
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

export async function saveSessionScopedJsonState<T>(
  namespace: string,
  state: T,
): Promise<void> {
  const filePath = await getSessionScopedStatePath(namespace);
  await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
