import { BaseContextProvider } from "..";
import { ContextProviderName } from "../..";
import CodebaseContextProvider from "./CodebaseContextProvider";
import CodeHighlightsContextProvider from "./CodeHighlightsContextProvider";
import CodeOutlineContextProvider from "./CodeOutlineContextProvider";
import DiffContextProvider from "./DiffContextProvider";
import DocsContextProvider from "./DocsContextProvider";
import FileTreeContextProvider from "./FileTreeContextProvider";
import FolderContextProvider from "./FolderContextProvider";
import GitHubIssuesContextProvider from "./GitHubIssuesContextProvider";
import GoogleContextProvider from "./GoogleContextProvider";
import HttpContextProvider from "./HttpContextProvider";
import OpenFilesContextProvider from "./OpenFilesContextProvider";
import ProblemsContextProvider from "./ProblemsContextProvider";
import SearchContextProvider from "./SearchContextProvider";
import TerminalContextProvider from "./TerminalContextProvider";
import LocalsProvider from "./LocalsProvider";
import URLContextProvider from "./URLContextProvider";
import JiraIssuesContextProvider from "./JiraIssuesContextProvider";

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
  CodeHighlightsContextProvider,
  CodeOutlineContextProvider,
  JiraIssuesContextProvider,
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
