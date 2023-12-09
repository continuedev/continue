import { ContextProvider } from "..";
import { ContextProviderName } from "../../config";
import DiffContextProvider from "./DiffContextProvider";
import FileTreeContextProvider from "./FileTreeContextProvider";
import GitHubIssuesContextProvider from "./GitHubIssuesContextProvider";
import GoogleContextProvider from "./GoogleContextProvider";
import TerminalContextProvider from "./TerminalContextProvider";
import URLContextProvider from "./URLContextProvider";

const Providers: (typeof ContextProvider)[] = [
  DiffContextProvider,
  FileTreeContextProvider,
  GitHubIssuesContextProvider,
  GoogleContextProvider,
  TerminalContextProvider,
  URLContextProvider,
];

export function contextProviderClassFromName(
  name: ContextProviderName
): typeof ContextProvider {
  const cls = Providers.find((cls) => cls.description.title === name);

  if (!cls) {
    throw new Error(`Unknown provider ${name}`);
  }

  return cls;
}
