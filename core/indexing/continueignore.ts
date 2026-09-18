import fs from "fs";
import { IDE } from "..";
import { getGlobalContinueIgnorePath } from "../util/paths";
import { gitIgArrayFromFile } from "./ignore";

export const getGlobalContinueIgArray = () => {
  const contents = fs.readFileSync(getGlobalContinueIgnorePath(), "utf8");
  return gitIgArrayFromFile(contents);
};

/**
 * Workspace ignore-file names, in precedence order. `.ruckusignore` is the
 * current name; `.continueignore` stays supported so repos written against
 * Continue keep working without edits.
 */
export const IGNORE_FILE_NAMES = [".ruckusignore", ".continueignore"] as const;

export const isIgnoreFileName = (name: string): boolean =>
  (IGNORE_FILE_NAMES as readonly string[]).includes(name);

export const getWorkspaceContinueIgArray = async (ide: IDE) => {
  const dirs = await ide.getWorkspaceDirs();
  return await dirs.reduce(
    async (accPromise, dir) => {
      const acc = await accPromise;
      const patterns: string[] = [];
      for (const fileName of IGNORE_FILE_NAMES) {
        try {
          const contents = await ide.readFile(`${dir}/${fileName}`);
          patterns.push(...gitIgArrayFromFile(contents));
        } catch (err) {
          // File simply may not exist; try the next supported name.
        }
      }
      return [...acc, ...patterns];
    },
    Promise.resolve([] as string[]),
  );
};
