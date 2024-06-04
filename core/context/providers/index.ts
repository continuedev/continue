import { ContextProviderName } from "../../index.js";
import { BaseContextProvider } from "../index.js";
import CodeContextProvider from "./CodeContextProvider.js";
// import CodeHighlightsContextProvider from "./CodeHighlightsContextProvider.js";
import CodebaseContextProvider from "./CodebaseContextProvider.js";
import CurrentFileContextProvider from "./CurrentFileContextProvider.js";
import DatabaseContextProvider from "./DatabaseContextProvider.js";
import DiffContextProvider from "./DiffContextProvider.js";
import DocsContextProvider from "./DocsContextProvider.js";
import FileTreeContextProvider from "./FileTreeContextProvider.js";
import FolderContextProvider from "./FolderContextProvider.js";
import GitHubIssuesContextProvider from "./GitHubIssuesContextProvider.js";
import GitLabMergeRequestContextProvider from "./GitLabMergeRequestContextProvider.js";
import GoogleContextProvider from "./GoogleContextProvider.js";
import HttpContextProvider from "./HttpContextProvider.js";
import JiraIssuesContextProvider from "./JiraIssuesContextProvider/index.js";
import LocalsProvider from "./LocalsProvider.js";
import OSContextProvider from "./OSContextProvider.js";
import OpenFilesContextProvider from "./OpenFilesContextProvider.js";
import PostgresContextProvider from "./PostgresContextProvider.js";
import ProblemsContextProvider from "./ProblemsContextProvider.js";
import SearchContextProvider from "./SearchContextProvider.js";
import TerminalContextProvider from "./TerminalContextProvider.js";
import URLContextProvider from "./URLContextProvider.js";

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
  CurrentFileContextProvider,
  URLContextProvider,
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
