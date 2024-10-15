import fs from "node:fs";
import { getGlobalContextFilePath } from "./paths";
import { EmbeddingsProvider } from "../";

export type GlobalContextType = {
  indexingPaused: boolean;
  selectedTabAutocompleteModel: string;
  lastSelectedProfileForWorkspace: { [workspaceIdentifier: string]: string };
  /**
   * This is needed to handle the case where a JetBrains user has created
   * docs embeddings using one provider, and then updates to a new provider.
   *
   * For VS Code users, it is unnecessary since we use transformers.js by default.
   */
  curEmbeddingsProviderId: EmbeddingsProvider["id"];
  hasDismissedConfigTsNoticeJetBrains: boolean;
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
