import {
  AssistantUnrolledNonNullable,
  ConfigValidationError,
} from "@continuedev/config-yaml";
import { IContextProvider } from "..";
import { contextProviderClassFromName } from "../context/providers";
import CurrentFileContextProvider from "../context/providers/CurrentFileContextProvider";
import DiffContextProvider from "../context/providers/DiffContextProvider";
import FileContextProvider from "../context/providers/FileContextProvider";
import ProblemsContextProvider from "../context/providers/ProblemsContextProvider";
import RulesContextProvider from "../context/providers/RulesContextProvider";
import TerminalContextProvider from "../context/providers/TerminalContextProvider";

/*
    Loads context providers based on configuration
    - default providers will always be loaded, using config params if present
    - other providers will be loaded if configured

    Note:
    - MCPContextProvider is added in doLoadConfig if any resources are present
    - DocsContextProvider is added in doLoadConfig if docs configs are present and it hasn't been added yet
*/
export function loadConfigContextProviders(
  configContext: AssistantUnrolledNonNullable["context"],
): {
  providers: IContextProvider[];
  errors: ConfigValidationError[];
} {
  const providers: IContextProvider[] = [];
  const errors: ConfigValidationError[] = [];
  // Add from config
  if (configContext) {
    for (const config of configContext) {
      const cls = contextProviderClassFromName(config.provider) as any;
      if (!cls) {
        errors.push({
          fatal: false,
          message: `Unknown context provider ${config.provider}`,
        });
        continue;
      }
      providers.push(
        new cls({
          name: config.name,
          ...config.params,
        }),
      );
    }
  }

  // Add from defaults if not found in config
  const DEFAULT_PROVIDERS: IContextProvider[] = [
    new TerminalContextProvider({}),
    new DiffContextProvider({}),
    new FileContextProvider({}),
    new CurrentFileContextProvider({}),
    new ProblemsContextProvider({}),
    new RulesContextProvider({}),
  ];

  for (const defaultProvider of DEFAULT_PROVIDERS) {
    if (
      !providers.find(
        (p) => p.description.title === defaultProvider.description.title,
      )
    ) {
      providers.push(defaultProvider);
    }
  }

  return {
    providers,
    errors,
  };
}
