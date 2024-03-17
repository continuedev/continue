import { BaseContextProvider } from "..";
import { ContextProviderName } from "../..";
import CodeContextProvider from "./CodeContextProvider";
import CodebaseContextProvider from "./CodebaseContextProvider";
import DatabaseContextProvider from "./DatabaseContextProvider";
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
import LocalsProvider from "./LocalsProvider";
import URLContextProvider from "./URLContextProvider";
import GitLabMergeRequestContextProvider from "./GitLabMergeRequestContextProvider";

const Providers: (typeof BaseContextProvider)[] = [
  DiffContextProvider,
  FileTreeContextProvider,
  GitHubIssuesContextProvider,
  GoogleContextProvider,
  TerminalContextProvider,
  LocalsProvider,
  URLContextProvider,
  OpenFilesContextProvider,
  HttpContextProvider,
  SearchContextProvider,
  CodebaseContextProvider,
  ProblemsContextProvider,
  FolderContextProvider,
  DocsContextProvider,
  GitLabMergeRequestContextProvider,
  // CodeHighlightsContextProvider,
  // CodeOutlineContextProvider,
  JiraIssuesContextProvider,
  PostgresContextProvider,
  DatabaseContextProvider,
  CodeContextProvider,
];

export function contextProviderClassFromName(
  name: ContextProviderName,
): typeof BaseContextProvider | undefined {
  const cls = Providers.find((cls) => cls.description.title === name);

  if (!cls) {
    return undefined;
  }

  return cls;
}
