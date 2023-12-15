import { BaseContextProvider } from "..";
import { ContextProviderName } from "../..";
import DiffContextProvider from "./DiffContextProvider";
import FileTreeContextProvider from "./FileTreeContextProvider";
import GitHubIssuesContextProvider from "./GitHubIssuesContextProvider";
import GoogleContextProvider from "./GoogleContextProvider";
import OpenFilesContextProvider from "./OpenFilesContextProvider";
import TerminalContextProvider from "./TerminalContextProvider";
import URLContextProvider from "./URLContextProvider";

const Providers: (typeof BaseContextProvider)[] = [
  DiffContextProvider,
  FileTreeContextProvider,
  GitHubIssuesContextProvider,
  GoogleContextProvider,
  TerminalContextProvider,
  URLContextProvider,
  OpenFilesContextProvider,
];

export function contextProviderClassFromName(
  name: ContextProviderName
): typeof BaseContextProvider | undefined {
  const cls = Providers.find((cls) => cls.description.title === name);

  if (!cls) {
    return undefined;
  }

  return cls;
}
