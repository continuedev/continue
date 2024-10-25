import { BaseContextProvider } from "../";
import { ContextProviderName } from "../../";
import CodeContextProvider from "./CodeContextProvider";
import ContinueProxyContextProvider from "./ContinueProxyContextProvider";
import CurrentFileContextProvider from "./CurrentFileContextProvider";
import DatabaseContextProvider from "./DatabaseContextProvider";
import DiffContextProvider from "./DiffContextProvider";
import DiscordContextProvider from "./DiscordContextProvider";
import DocsContextProvider from "./DocsContextProvider";
import FileTreeContextProvider from "./FileTreeContextProvider";
import FolderContextProvider from "./FolderContextProvider";
import GitHubIssuesContextProvider from "./GitHubIssuesContextProvider";
import GitLabMergeRequestContextProvider from "./GitLabMergeRequestContextProvider";
import GoogleContextProvider from "./GoogleContextProvider";
import GreptileContextProvider from "./GreptileContextProvider";
import HttpContextProvider from "./HttpContextProvider";
import JiraIssuesContextProvider from "./JiraIssuesContextProvider/";
import DebugLocalsProvider from "./DebugLocalsProvider";
import OSContextProvider from "./OSContextProvider";
import OpenFilesContextProvider from "./OpenFilesContextProvider";
import PostgresContextProvider from "./PostgresContextProvider";
import ProblemsContextProvider from "./ProblemsContextProvider";
import RepoMapContextProvider from "./RepoMapContextProvider";
import SearchContextProvider from "./SearchContextProvider";
import TerminalContextProvider from "./TerminalContextProvider";
import URLContextProvider from "./URLContextProvider";
import WebContextProvider from "./WebContextProvider";

/**
 * Note: We are currently omitting the following providers due to bugs:
 * - `CodeOutlineContextProvider`
 * - `CodeHighlightsContextProvider`
 *
 * See this issue for details: https://github.com/continuedev/continue/issues/1365
 */
export const Providers: (typeof BaseContextProvider)[] = [
  DiffContextProvider,
  FileTreeContextProvider,
  GitHubIssuesContextProvider,
  GoogleContextProvider,
  TerminalContextProvider,
  DebugLocalsProvider,
  OpenFilesContextProvider,
  HttpContextProvider,
  SearchContextProvider,
  OSContextProvider,
  ProblemsContextProvider,
  FolderContextProvider,
  DocsContextProvider,
  GitLabMergeRequestContextProvider,
  JiraIssuesContextProvider,
  PostgresContextProvider,
  DatabaseContextProvider,
  CodeContextProvider,
  CurrentFileContextProvider,
  URLContextProvider,
  ContinueProxyContextProvider,
  RepoMapContextProvider,
  DiscordContextProvider,
  GreptileContextProvider,
  WebContextProvider,
];

export function contextProviderClassFromName(
  name: ContextProviderName,
): typeof BaseContextProvider | undefined {
  return Providers.find((cls) => cls.description.title === name);
}
