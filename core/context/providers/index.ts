import { BaseContextProvider } from "../";
import { ContextProviderName } from "../../";

import ClipboardContextProvider from "./ClipboardContextProvider";
import CodebaseContextProvider from "./CodebaseContextProvider";
import CodeContextProvider from "./CodeContextProvider";
import ContinueProxyContextProvider from "./ContinueProxyContextProvider";
import CurrentFileContextProvider from "./CurrentFileContextProvider";
import DatabaseContextProvider from "./DatabaseContextProvider";
import DebugLocalsProvider from "./DebugLocalsProvider";
import DiffContextProvider from "./DiffContextProvider";
import FileContextProvider from "./FileContextProvider";
import FileTreeContextProvider from "./FileTreeContextProvider";
import FolderContextProvider from "./FolderContextProvider";
import GitCommitContextProvider from "./GitCommitContextProvider";
import HttpContextProvider from "./HttpContextProvider";
import OpenFilesContextProvider from "./OpenFilesContextProvider";
import OSContextProvider from "./OSContextProvider";
import PostgresContextProvider from "./PostgresContextProvider";
import ProblemsContextProvider from "./ProblemsContextProvider";
import RepoMapContextProvider from "./RepoMapContextProvider";
import RulesContextProvider from "./RulesContextProvider";
import SearchContextProvider from "./SearchContextProvider";
import TerminalContextProvider from "./TerminalContextProvider";
import URLContextProvider from "./URLContextProvider";
import WebContextProvider from "./WebContextProvider";

/* Documentation unavailable in air-gapped mode */
export const Providers: (typeof BaseContextProvider)[] = [
  FileContextProvider,
  DiffContextProvider,
  FileTreeContextProvider,
  TerminalContextProvider,
  DebugLocalsProvider,
  OpenFilesContextProvider,
  HttpContextProvider,
  SearchContextProvider,
  OSContextProvider,
  ProblemsContextProvider,
  FolderContextProvider,
  PostgresContextProvider,
  DatabaseContextProvider,
  CodebaseContextProvider,
  CodeContextProvider,
  CurrentFileContextProvider,
  URLContextProvider,
  ContinueProxyContextProvider,
  RepoMapContextProvider,
  WebContextProvider,
  GitCommitContextProvider,
  ClipboardContextProvider,
  RulesContextProvider,
];

export function contextProviderClassFromName(
  name: ContextProviderName,
): typeof BaseContextProvider | undefined {
  const provider = Providers.find((cls) => cls.description.title === name);

  return provider;
}
