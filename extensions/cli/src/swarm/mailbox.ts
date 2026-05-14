import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { withFileLock } from "./fileLock.js";
import { getTeamDir, sanitizeName } from "./teamRuntime.js";

export type SwarmMailboxMessageKind = "prompt" | "message" | "control";

export interface SwarmMailboxMessage {
  id: string;
  from: string;
  text: string;
  timestamp: string;
  summary?: string;
  read: boolean;
  kind: SwarmMailboxMessageKind;
  metadata?: Record<string, unknown>;
}

function getMailboxDir(teamName: string): string {
  return path.join(getTeamDir(teamName), "mailboxes");
}

export function getMailboxPath(teamName: string, teammateName: string): string {
  return path.join(
    getMailboxDir(teamName),
    `${sanitizeName(teammateName) || "teammate"}.json`,
  );
}

function getMailboxLockPath(teamName: string, teammateName: string): string {
  return `${getMailboxPath(teamName, teammateName)}.lock`;
}

async function ensureMailboxFile(
  teamName: string,
  teammateName: string,
): Promise<void> {
  const mailboxPath = getMailboxPath(teamName, teammateName);
  await fs.mkdir(path.dirname(mailboxPath), { recursive: true });
  try {
    await fs.access(mailboxPath);
  } catch {
    await fs.writeFile(mailboxPath, "[]\n", "utf8");
  }
}

export async function readMailbox(
  teamName: string,
  teammateName: string,
): Promise<SwarmMailboxMessage[]> {
  try {
    const content = await fs.readFile(
      getMailboxPath(teamName, teammateName),
      "utf8",
    );
    return JSON.parse(content) as SwarmMailboxMessage[];
  } catch {
    return [];
  }
}

export async function appendMailboxMessage(input: {
  teamName: string;
  teammateName: string;
  message: Omit<SwarmMailboxMessage, "id" | "read"> & { id?: string };
}): Promise<SwarmMailboxMessage> {
  await ensureMailboxFile(input.teamName, input.teammateName);

  return withFileLock(
    getMailboxLockPath(input.teamName, input.teammateName),
    async () => {
      const messages = await readMailbox(input.teamName, input.teammateName);
      const nextMessage: SwarmMailboxMessage = {
        id: input.message.id ?? randomUUID(),
        from: input.message.from,
        text: input.message.text,
        timestamp: input.message.timestamp,
        summary: input.message.summary,
        kind: input.message.kind,
        metadata: input.message.metadata,
        read: false,
      };

      messages.push(nextMessage);
      await fs.writeFile(
        getMailboxPath(input.teamName, input.teammateName),
        `${JSON.stringify(messages, null, 2)}\n`,
        "utf8",
      );

      return nextMessage;
    },
  );
}

export async function readUnreadMailboxMessages(
  teamName: string,
  teammateName: string,
): Promise<SwarmMailboxMessage[]> {
  const messages = await readMailbox(teamName, teammateName);
  return messages.filter((message) => !message.read);
}

export async function takeUnreadMailboxMessages(
  teamName: string,
  teammateName: string,
): Promise<SwarmMailboxMessage[]> {
  await ensureMailboxFile(teamName, teammateName);

  return withFileLock(getMailboxLockPath(teamName, teammateName), async () => {
    const messages = await readMailbox(teamName, teammateName);
    const unread = messages.filter((message) => !message.read);
    if (unread.length === 0) {
      return [];
    }

    const readIds = new Set(unread.map((message) => message.id));
    const nextMessages = messages.map((message) =>
      readIds.has(message.id) ? { ...message, read: true } : message,
    );
    await fs.writeFile(
      getMailboxPath(teamName, teammateName),
      `${JSON.stringify(nextMessages, null, 2)}\n`,
      "utf8",
    );

    return unread;
  });
}
