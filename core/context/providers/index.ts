import { BaseContextProvider } from "..";
import { ContextProviderName } from "../..";
import CodeHighlightsContextProvider from "./CodeHighlightsContextProvider";
import CodeOutlineContextProvider from "./CodeOutlineContextProvider";
import CodebaseContextProvider from "./CodebaseContextProvider";
import DiffContextProvider from "./DiffContextProvider";
import DocsContextProvider from "./DocsContextProvider";
import FileTreeContextProvider from "./FileTreeContextProvider";
import FolderContextProvider from "./FolderContextProvider";
import GitHubIssuesContextProvider from "./GitHubIssuesContextProvider";
import GoogleContextProvider from "./GoogleContextProvider";
import HttpContextProvider from "./HttpContextProvider";
import JiraIssuesContextProvider from "./JiraIssuesContextProvider";
import OpenFilesContextProvider from "./OpenFilesContextProvider";
import PostgresContextProvider from "./PostgresContextProvider";
import ProblemsContextProvider from "./ProblemsContextProvider";
import SearchContextProvider from "./SearchContextProvider";
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
  HttpContextProvider,
  SearchContextProvider,
  CodebaseContextProvider,
  ProblemsContextProvider,
  FolderContextProvider,
  DocsContextProvider,
  CodeHighlightsContextProvider,
  CodeOutlineContextProvider,
  JiraIssuesContextProvider,
  PostgresContextProvider,
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
