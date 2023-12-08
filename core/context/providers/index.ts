import DiffContextProvider from "./DiffContextProvider";
import GitHubIssuesContextProvider from "./GitHubIssuesContextProvider";
import TerminalContextProvider from "./TerminalContextProvider";
import OpenTabsContextProvider from "./OpenTabsContextProvider";
import GoogleContextProvider from "./GoogleContextProvider";
import SearchContextProvider from "./SearchContextProvider";
import URLContextProvider from "./URLContextProvider";
import FileTreeContextProvider from "./FileTreeContextProvider";

export default {
  diff: DiffContextProvider,
  github: GitHubIssuesContextProvider,
  terminal: TerminalContextProvider,
  open: OpenTabsContextProvider,
  google: GoogleContextProvider,
  search: SearchContextProvider,
  url: URLContextProvider,
  tree: FileTreeContextProvider,
};
