import fs from "fs";
import { IDE } from "..";
import { getGlobalContinueIgnorePath } from "../util/paths";
import { gitIgArrayFromFile } from "./ignore";
import { IGNORE_FILES } from "../util/workspaceDirs";

export const getGlobalContinueIgArray = () => {
  const contents = fs.readFileSync(getGlobalContinueIgnorePath(), "utf8");
  return gitIgArrayFromFile(contents);
};

export const getWorkspaceContinueIgArray = async (ide: IDE) => {
  const dirs = await ide.getWorkspaceDirs();
  return await dirs.reduce(
    async (accPromise, dir) => {
      const acc = await accPromise;
      const patterns: string[] = [];
      for (const name of IGNORE_FILES) {
        try {
          const contents = await ide.readFile(`${dir}/${name}`);
          patterns.push(...gitIgArrayFromFile(contents));
        } catch (err) {
          // A workspace without this file
        }
      }
      return [...acc, ...patterns];
    },
    Promise.resolve([] as string[]),
  );
};
