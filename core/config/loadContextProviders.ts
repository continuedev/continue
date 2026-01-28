import {
  AssistantUnrolledNonNullable,
  ConfigValidationError,
} from "@continuedev/config-yaml";
import { IContextProvider, IdeType } from "..";
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

    NOTE the MCPContextProvider is added in doLoadConfig if any resources are present
*/
export function loadConfigContextProviders(
  _configContext: AssistantUnrolledNonNullable["context"] | undefined,
  _hasDocs: boolean,
  ideType: IdeType,
): {
  providers: IContextProvider[];
  errors: ConfigValidationError[];
} {
  const providers: IContextProvider[] = [
    new FileContextProvider({}),
    new CurrentFileContextProvider({}),
    new DiffContextProvider({}),
    new TerminalContextProvider({}),
    new ProblemsContextProvider({}),
    new RulesContextProvider({}),
  ];

  // @problems and @terminal are not supported in JetBrains
  const filteredProviders =
    ideType === "jetbrains"
      ? providers.filter(
          (p) =>
            p.description.title !== TerminalContextProvider.description.title &&
            p.description.title !== ProblemsContextProvider.description.title,
        )
      : providers;

  return {
    providers: filteredProviders,
    errors: [],
  };
}
