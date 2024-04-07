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
import GitLabMergeRequestContextProvider from "./GitLabMergeRequestContextProvider";
import GoogleContextProvider from "./GoogleContextProvider";
import HttpContextProvider from "./HttpContextProvider";
import JiraIssuesContextProvider from "./JiraIssuesContextProvider";
import LocalsProvider from "./LocalsProvider";
import OSContextProvider from "./OSContextProvider";
import OpenFilesContextProvider from "./OpenFilesContextProvider";
import PostgresContextProvider from "./PostgresContextProvider";
import ProblemsContextProvider from "./ProblemsContextProvider";
import SearchContextProvider from "./SearchContextProvider";
import TerminalContextProvider from "./TerminalContextProvider";

const Providers: (typeof BaseContextProvider)[] = [
  DiffContextProvider,
  FileTreeContextProvider,
  GitHubIssuesContextProvider,
  GoogleContextProvider,
  TerminalContextProvider,
  LocalsProvider,
  OpenFilesContextProvider,
  HttpContextProvider,
  SearchContextProvider,
  OSContextProvider,
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
