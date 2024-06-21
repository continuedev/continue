import { IDE } from "..";
import { ToIdeFromWebviewOrCoreProtocol } from "../protocol/ide";
import { Message } from "./messenger";

export class ReverseMessageIde {
  private on<T extends keyof ToIdeFromWebviewOrCoreProtocol>(
    messageType: T,
    handler: (
      data: ToIdeFromWebviewOrCoreProtocol[T][0],
    ) =>
      | Promise<ToIdeFromWebviewOrCoreProtocol[T][1]>
      | ToIdeFromWebviewOrCoreProtocol[T][1],
  ): void {
    this._on(messageType, (msg) => {
      const data = msg.data;
      const result = handler(data);
      return result;
    });
  }

  constructor(
    private readonly _on: <T extends keyof ToIdeFromWebviewOrCoreProtocol>(
      messageType: T,
      handler: (
        message: Message<ToIdeFromWebviewOrCoreProtocol[T][0]>,
      ) =>
        | Promise<ToIdeFromWebviewOrCoreProtocol[T][1]>
        | ToIdeFromWebviewOrCoreProtocol[T][1],
    ) => void,
    private readonly ide: IDE,
  ) {
    this.initializeListeners();
  }

  private initializeListeners() {
    this.on("getGitHubAuthToken", () => {
      return this.ide.getGitHubAuthToken();
    });

    this.on("getLastModified", (data) => {
      return this.ide.getLastModified(data.files);
    });

    this.on("getGitRootPath", (data) => {
      return this.ide.getGitRootPath(data.dir);
    });

    this.on("listDir", (data) => {
      return this.ide.listDir(data.dir);
    });

    this.on("infoPopup", (data) => {
      return this.ide.infoPopup(data.message);
    });

    this.on("errorPopup", (data) => {
      return this.ide.errorPopup(data.message);
    });

    this.on("getRepoName", (data) => {
      return this.ide.getRepoName(data.dir);
    });

    this.on("getDebugLocals", (data) => {
      return this.ide.getDebugLocals(data.threadIndex);
    });

    this.on("getTopLevelCallStackSources", (data) => {
      return this.ide.getTopLevelCallStackSources(
        data.threadIndex,
        data.stackDepth,
      );
    });

    this.on("getAvailableThreads", () => {
      return this.ide.getAvailableThreads();
    });

    this.on("getTags", (data) => {
      return this.ide.getTags(data);
    });

    this.on("getIdeInfo", () => {
      return this.ide.getIdeInfo();
    });

    this.on("readRangeInFile", (data) => {
      return this.ide.readRangeInFile(data.filepath, data.range);
    });

    this.on("isTelemetryEnabled", () => {
      return this.ide.isTelemetryEnabled();
    });

    this.on("getUniqueId", () => {
      return this.ide.getUniqueId();
    });

    this.on("getWorkspaceConfigs", () => {
      return this.ide.getWorkspaceConfigs();
    });

    this.on("getIdeSettings", () => {
      return this.ide.getIdeSettings();
    });

    this.on("getDiff", () => {
      return this.ide.getDiff();
    });

    this.on("getTerminalContents", () => {
      return this.ide.getTerminalContents();
    });

    this.on("listWorkspaceContents", (data) => {
      return this.ide.listWorkspaceContents(data.directory, data.useGitIgnore);
    });

    this.on("getWorkspaceDirs", () => {
      return this.ide.getWorkspaceDirs();
    });

    this.on("showLines", (data) => {
      return this.ide.showLines(data.filepath, data.startLine, data.endLine);
    });

    this.on("listFolders", () => {
      return this.ide.listFolders();
    });

    this.on("getContinueDir", () => {
      return this.ide.getContinueDir();
    });

    this.on("writeFile", (data) => {
      return this.ide.writeFile(data.path, data.contents);
    });

    this.on("showVirtualFile", (data) => {
      return this.ide.showVirtualFile(data.name, data.content);
    });

    this.on("openFile", (data) => {
      return this.ide.openFile(data.path);
    });

    this.on("runCommand", (data) => {
      return this.ide.runCommand(data.command);
    });

    this.on("saveFile", (data) => {
      return this.ide.saveFile(data.filepath);
    });

    this.on("readFile", (data) => {
      return this.ide.readFile(data.filepath);
    });

    this.on("showDiff", (data) => {
      return this.ide.showDiff(data.filepath, data.newContents, data.stepIndex);
    });

    this.on("getOpenFiles", () => {
      return this.ide.getOpenFiles();
    });

    this.on("getCurrentFile", () => {
      return this.ide.getCurrentFile();
    });

    this.on("getPinnedFiles", () => {
      return this.ide.getPinnedFiles();
    });

    this.on("getSearchResults", (data) => {
      return this.ide.getSearchResults(data.query);
    });

    this.on("getProblems", (data) => {
      return this.ide.getProblems(data.filepath);
    });

    this.on("subprocess", (data) => {
      return this.ide.subprocess(data.command);
    });

    this.on("getBranch", (data) => {
      return this.ide.getBranch(data.dir);
    });
  }
}
