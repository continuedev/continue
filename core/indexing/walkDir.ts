import ignore, { Ignore } from "ignore";

import type { FileType, IDE } from "..";

import {
  DEFAULT_IGNORE_DIRS,
  DEFAULT_IGNORE_FILETYPES,
  defaultIgnoreDir,
  defaultIgnoreFile,
  getGlobalContinueIgArray,
  gitIgArrayFromFile,
} from "./ignore";
import { joinPathsToUri } from "../util/uri";

export interface WalkerOptions {
  ignoreFiles?: string[];
  onlyDirs?: boolean;
  returnRelativeUrisPaths?: boolean;
  additionalIgnoreRules?: string[];
}

type Entry = [string, FileType];

// helper struct used for the DFS walk
type WalkableEntry = {
  relativeUriPath: string;
  uri: string;
  type: FileType;
  entry: Entry;
};

// helper struct used for the DFS walk
type WalkContext = {
  walkableEntry: WalkableEntry;
  ignoreContexts: IgnoreContext[];
};

type IgnoreContext = {
  ignore: Ignore;
  dirname: string;
};

class DFSWalker {
  private readonly ignoreFileNames: Set<string>;

  constructor(
    private readonly uri: string,
    private readonly ide: IDE,
    private readonly options: WalkerOptions,
  ) {
    this.ignoreFileNames = new Set<string>(options.ignoreFiles);
  }

  // walk is a depth-first search implementation
  public async *walk(): AsyncGenerator<string> {
    const root = this.newRootWalkContext();
    const stack = [root];
    for (let cur = stack.pop(); cur; cur = stack.pop()) {
      const walkableEntries = await this.listDirForWalking(cur.walkableEntry);
      const ignoreContexts = await this.getIgnoreToApplyInDir(
        cur,
        walkableEntries,
      );
      for (const w of walkableEntries) {
        if (!this.shouldInclude(w, ignoreContexts)) {
          continue;
        }
        if (this.entryIsDirectory(w.entry)) {
          stack.push({
            walkableEntry: w,
            ignoreContexts: ignoreContexts,
          });
          if (this.options.onlyDirs) {
            // when onlyDirs is enabled the walker will only return directory names
            if (this.options.returnRelativeUrisPaths) {
              yield w.relativeUriPath;
            } else {
              yield w.uri;
            }
          }
        } else {
          // Note that shouldInclude handles skipping files if options.onlyDirs is true
          if (this.options.returnRelativeUrisPaths) {
            yield w.relativeUriPath;
          } else {
            yield w.uri;
          }
        }
      }
    }
  }

  private newRootWalkContext(): WalkContext {
    const globalIgnoreFile = getGlobalContinueIgArray();
    return {
      walkableEntry: {
        relativeUriPath: "",
        uri: this.uri,
        type: 2 as FileType.Directory,
        entry: ["", 2 as FileType.Directory],
      },
      ignoreContexts: [
        {
          ignore: ignore()
            .add(defaultIgnoreDir)
            .add(defaultIgnoreFile)
            .add(globalIgnoreFile),
          dirname: "",
        },
      ],
    };
  }

  private async listDirForWalking(
    walkableEntry: WalkableEntry,
  ): Promise<WalkableEntry[]> {
    const entries = await this.ide.listDir(walkableEntry.uri);
    return entries.map((e) => ({
      relativeUriPath: `${walkableEntry.relativeUriPath}${walkableEntry.relativeUriPath ? "/" : ""}${e[0]}`,
      uri: joinPathsToUri(walkableEntry.uri, e[0]),
      type: e[1],
      entry: e,
    }));
  }

  private async getIgnoreToApplyInDir(
    curDir: WalkContext,
    entriesInDir: WalkableEntry[],
  ): Promise<IgnoreContext[]> {
    const ignoreFilesInDir = await this.loadIgnoreFiles(entriesInDir);
    if (ignoreFilesInDir.length === 0) {
      return curDir.ignoreContexts;
    }
    const patterns = ignoreFilesInDir.map((c) => gitIgArrayFromFile(c)).flat();
    const newIgnoreContext = {
      ignore: ignore().add(patterns),
      dirname: curDir.walkableEntry.relativeUriPath,
    };
    return [...curDir.ignoreContexts, newIgnoreContext];
  }

  private async loadIgnoreFiles(entries: WalkableEntry[]): Promise<string[]> {
    const ignoreEntries = entries.filter((w) =>
      this.entryIsIgnoreFile(w.entry),
    );
    const promises = ignoreEntries.map(async (w) => {
      return await this.ide.readFile(w.uri);
    });
    return Promise.all(promises);
  }

  private shouldInclude(
    walkableEntry: WalkableEntry,
    ignoreContexts: IgnoreContext[],
  ) {
    if (this.entryIsSymlink(walkableEntry.entry)) {
      // If called from the root, a symlink either links to a real file in this repository,
      // and therefore will be walked OR it links to something outside of the repository and
      // we do not want to index it
      return false;
    }
    let relPath = walkableEntry.relativeUriPath;
    if (this.entryIsDirectory(walkableEntry.entry)) {
      relPath = `${relPath}/`;
    } else {
      if (this.options.onlyDirs) {
        return false;
      }
    }
    for (const ig of ignoreContexts) {
      // remove the directory name and path separator from the match path, unless this an ignore file
      // in the root directory
      const prefixLength = ig.dirname.length === 0 ? 0 : ig.dirname.length + 1;
      // The ignore library expects a path relative to the ignore file location
      const matchPath = relPath.substring(prefixLength);
      if (ig.ignore.ignores(matchPath)) {
        return false;
      }
    }
    return true;
  }

  private entryIsDirectory(entry: Entry) {
    return entry[1] === (2 as FileType.Directory);
  }

  private entryIsSymlink(entry: Entry) {
    return entry[1] === (64 as FileType.SymbolicLink);
  }

  private entryIsIgnoreFile(e: Entry): boolean {
    if (
      e[1] === (2 as FileType.Directory) ||
      e[1] === (64 as FileType.SymbolicLink)
    ) {
      return false;
    }
    return this.ignoreFileNames.has(e[0]);
  }
}

const defaultOptions: WalkerOptions = {
  ignoreFiles: [".gitignore", ".continueignore"],
  additionalIgnoreRules: [...DEFAULT_IGNORE_DIRS, ...DEFAULT_IGNORE_FILETYPES],
  onlyDirs: false,
  returnRelativeUrisPaths: false,
};

export async function walkDir(
  uri: string,
  ide: IDE,
  _optionOverrides?: WalkerOptions,
): Promise<string[]> {
  let urisOrRelativePaths: string[] = [];
  for await (const p of walkDirAsync(uri, ide, _optionOverrides)) {
    urisOrRelativePaths.push(p);
  }
  return urisOrRelativePaths;
}

export async function* walkDirAsync(
  path: string,
  ide: IDE,
  _optionOverrides?: WalkerOptions,
): AsyncGenerator<string> {
  const options = { ...defaultOptions, ..._optionOverrides };
  yield* new DFSWalker(path, ide, options).walk();
}

export async function walkDirs(
  ide: IDE,
  _optionOverrides?: WalkerOptions,
  dirs?: string[], // Can pass dirs to prevent duplicate calls
): Promise<string[]> {
  const workspaceDirs = dirs ?? (await ide.getWorkspaceDirs());
  const results = await Promise.all(
    workspaceDirs.map((dir) => walkDir(dir, ide, _optionOverrides)),
  );
  return results.flat();
}
