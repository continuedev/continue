import type { IDE } from "core";
import { resolveRelativePathInDir } from "core/util/ideUtils";
import { reminderFileStamp } from "core/util/loopReminders";

/**
 * VS Code's readFile returns all of an open document, but cuts a closed file
 * at 100 KB and returns nothing past 1 MB. A read this long or this empty may
 * be partial, so the same file could stamp differently: use its size and time.
 */
const READ_MAY_BE_PARTIAL_AT = 90_000;

/** A file URI for an absolute path, or undefined for a relative one. */
function absoluteUri(file: string): string | undefined {
  if (file.startsWith("file://")) return file;
  if (file.startsWith("/")) return `file://${encodeURI(file)}`;
  if (/^[A-Za-z]:[\\/]/.test(file)) {
    return `file:///${encodeURI(file.replace(/\\/g, "/"))}`;
  }
  return undefined;
}

async function stampUri(ide: IDE, uri: string): Promise<string> {
  const content = await ide.readFile(uri);
  if (content.length === 0 || content.length >= READ_MAY_BE_PARTIAL_AT) {
    const stats = (await ide.getFileStats([uri]))[uri];
    if (stats) return `stat:${stats.size}:${stats.lastModified}`;
  }
  return reminderFileStamp(content);
}

async function stampFile(ide: IDE, file: string): Promise<string> {
  try {
    const uri =
      absoluteUri(file) ?? (await resolveRelativePathInDir(file, ide));
    if (!uri || !(await ide.fileExists(uri))) {
      return reminderFileStamp(undefined);
    }
    return await stampUri(ide, uri);
  } catch {
    return reminderFileStamp(undefined);
  }
}

/** The current stamps of a reminder's files, by path. */
export async function stampLoopFiles(
  ide: IDE,
  files: string[],
): Promise<Record<string, string>> {
  const stamps = await Promise.all(files.map((file) => stampFile(ide, file)));
  return Object.fromEntries(files.map((file, i) => [file, stamps[i]]));
}
