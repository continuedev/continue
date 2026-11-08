import fs from "fs";
import path from "path";

import { reminderFileStamp } from "core/util/loopReminders.js";

/** The current stamp of a reminder's file, relative to the working directory. */
export function stampFile(file: string): string {
  try {
    const content = fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");
    return reminderFileStamp(content);
  } catch {
    return reminderFileStamp(undefined);
  }
}

/** The current stamps of a reminder's files, by path. */
export function stampFiles(files: string[]): Record<string, string> {
  return Object.fromEntries(files.map((file) => [file, stampFile(file)]));
}
