import fs from "node:fs";
import { getGlobalContextFilePath } from "./paths.js";

export type GlobalContextType = {
  indexingPaused: boolean;
  selectedTabAutocompleteModel: string;
  lastSelectedProfileForWorkspace: { [workspaceIdentifier: string]: string };
};

/**
 * A way to persist global state
 */
export class GlobalContext {
  update<T extends keyof GlobalContextType>(
    key: T,
    value: GlobalContextType[T],
  ) {
    if (!fs.existsSync(getGlobalContextFilePath())) {
      fs.writeFileSync(
        getGlobalContextFilePath(),
        JSON.stringify(
          {
            [key]: value,
          },
          null,
          2,
        ),
      );
    } else {
      const data = fs.readFileSync(getGlobalContextFilePath(), "utf-8");
      const parsed = JSON.parse(data);
      parsed[key] = value;
      fs.writeFileSync(
        getGlobalContextFilePath(),
        JSON.stringify(parsed, null, 2),
      );
    }
  }

  get<T extends keyof GlobalContextType>(
    key: T,
  ): GlobalContextType[T] | undefined {
    if (!fs.existsSync(getGlobalContextFilePath())) {
      return undefined;
    }

    const data = fs.readFileSync(getGlobalContextFilePath(), "utf-8");
    const parsed = JSON.parse(data);
    return parsed[key];
  }
}
