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
): typeof ContextProvider | undefined {
  const cls = Providers.find((cls) => cls.description.title === name);

  if (!cls) {
    return undefined;
  }

  return cls;
}
