import ignore, { Ignore } from "ignore";
import path from "node:path";
import { FileType, IDE } from "../index.d.js";
import {
  DEFAULT_IGNORE_DIRS,
  DEFAULT_IGNORE_FILETYPES,
  defaultIgnoreDir,
  defaultIgnoreFile,
  getGlobalContinueIgArray,
  gitIgArrayFromFile,
} from "./ignore.js";

export interface WalkerOptions {
  ignoreFiles?: string[];
  onlyDirs?: boolean;
  returnRelativePaths?: boolean;
  additionalIgnoreRules?: string[];
}

type Entry = [string, FileType];

// helper struct used for the DFS walk
type WalkableEntry = {
  relPath: string;
  absPath: string;
  type: FileType;
  entry: Entry;
};

// helper struct used for the DFS walk
type WalkContext = {
  walkableEntry: WalkableEntry;
  gitIgnoreContexts: IgnoreContext[];
  continueIgnoreContexts: IgnoreContext[];
};

type IgnoreContext = {
  ignore: Ignore;
  dirname: string;
};

class DFSWalker {
  private readonly gitIgnoreFiles: Set<string>;
  private readonly continueIgnoreFiles: Set<string>;

  constructor(
    private readonly path: string,
    private readonly ide: IDE,
    private readonly options: WalkerOptions,
  ) {
    // Split ignore files into git and continue ignores
    this.gitIgnoreFiles = new Set([".gitignore"]);
    this.continueIgnoreFiles = new Set([".continueignore"]);
  }

  // walk is a depth-first search implementation
  public async *walk(): AsyncGenerator<string> {
    const fixupFunc = await this.newPathFixupFunc(
      this.options.returnRelativePaths ? "" : this.path,
      this.ide,
    );
    const root = await this.newRootWalkContext();
    const stack = [root];

    for (let cur = stack.pop(); cur; cur = stack.pop()) {
      const walkableEntries = await this.listDirForWalking(cur.walkableEntry);
      const [gitIgnoreContexts, continueIgnoreContexts] =
        await this.getIgnoreToApplyInDir(cur, walkableEntries);

      for (const w of walkableEntries) {
        if (!this.shouldInclude(w, gitIgnoreContexts, continueIgnoreContexts)) {
          continue;
        }
        if (this.entryIsDirectory(w.entry)) {
          stack.push({
            walkableEntry: w,
            gitIgnoreContexts,
            continueIgnoreContexts,
          });
          if (this.options.onlyDirs) {
            // when onlyDirs is enabled the walker will only return directory names
            yield fixupFunc(w.relPath);
          }
        } else {
          yield fixupFunc(w.relPath);
        }
      }
    }
  }

  private async newRootWalkContext(): Promise<WalkContext> {
    const globalIgnore = ignore().add(defaultIgnoreDir).add(defaultIgnoreFile);
    const globalContinueIgnore = ignore().add(getGlobalContinueIgArray());

    return {
      walkableEntry: {
        relPath: "",
        absPath: this.path,
        type: 2 as FileType.Directory,
        entry: ["", 2 as FileType.Directory],
      },
      gitIgnoreContexts: [
        {
          ignore: globalIgnore,
          dirname: "",
        },
      ],
      continueIgnoreContexts: [
        {
          ignore: globalContinueIgnore,
          dirname: "",
        },
      ],
    };
  }

  private async listDirForWalking(
    walkableEntry: WalkableEntry,
  ): Promise<WalkableEntry[]> {
    const entries = await this.ide.listDir(walkableEntry.absPath);
    return entries.map((e) => {
      return {
        relPath: path.join(walkableEntry.relPath, e[0]),
        absPath: path.join(walkableEntry.absPath, e[0]),
        type: e[1],
        entry: e,
      };
    });
  }

  private async getIgnoreToApplyInDir(
    curDir: WalkContext,
    entriesInDir: WalkableEntry[],
  ): Promise<[IgnoreContext[], IgnoreContext[]]> {
    const ignoreFilesInDir = await this.loadIgnoreFiles(entriesInDir);

    if (
      ignoreFilesInDir.git.length === 0 &&
      ignoreFilesInDir.continue.length === 0
    ) {
      return [curDir.gitIgnoreContexts, curDir.continueIgnoreContexts];
    }

    const gitPatterns = ignoreFilesInDir.git
      .map((c) => gitIgArrayFromFile(c))
      .flat();
    const continuePatterns = ignoreFilesInDir.continue
      .map((c) => gitIgArrayFromFile(c))
      .flat();

    const newGitContext =
      gitPatterns.length > 0
        ? [
            {
              ignore: ignore().add(gitPatterns),
              dirname: curDir.walkableEntry.relPath,
            },
          ]
        : [];

    const newContinueContext =
      continuePatterns.length > 0
        ? [
            {
              ignore: ignore().add(continuePatterns),
              dirname: curDir.walkableEntry.relPath,
            },
          ]
        : [];

    return [
      [...curDir.gitIgnoreContexts, ...newGitContext],
      [...curDir.continueIgnoreContexts, ...newContinueContext],
    ];
  }

  private async loadIgnoreFiles(entries: WalkableEntry[]): Promise<{
    git: string[];
    continue: string[];
  }> {
    const gitIgnoreEntries = entries.filter((w) =>
      this.isGitIgnoreFile(w.entry),
    );
    const continueIgnoreEntries = entries.filter((w) =>
      this.isContinueIgnoreFile(w.entry),
    );

    const gitPromises = gitIgnoreEntries.map((w) =>
      this.ide.readFile(w.absPath),
    );
    const continuePromises = continueIgnoreEntries.map((w) =>
      this.ide.readFile(w.absPath),
    );

    const [gitResults, continueResults] = await Promise.all([
      Promise.all(gitPromises),
      Promise.all(continuePromises),
    ]);

    return {
      git: gitResults,
      continue: continueResults,
    };
  }

  private isGitIgnoreFile(e: Entry): boolean {
    return this.gitIgnoreFiles.has(e[0]);
  }

  private isContinueIgnoreFile(e: Entry): boolean {
    return this.continueIgnoreFiles.has(e[0]);
  }

  private shouldInclude(
    walkableEntry: WalkableEntry,
    gitIgnoreContexts: IgnoreContext[],
    continueIgnoreContexts: IgnoreContext[],
  ) {
    if (this.entryIsSymlink(walkableEntry.entry)) {
      // If called from the root, a symlink either links to a real file in this repository,
      // and therefore will be walked OR it linksto something outside of the repository and
      // we do not want to index it
      return false;
    }

    let relPath = walkableEntry.relPath;
    if (this.entryIsDirectory(walkableEntry.entry)) {
      relPath = `${relPath}/`;
    } else {
      if (this.options.onlyDirs) {
        return false;
      }
    }

    // First check gitignore rules
    for (const ig of gitIgnoreContexts) {
      // remove the directory name and path seperator from the match path, unless this an ignore file
      // in the root directory

      const prefixLength = ig.dirname.length === 0 ? 0 : ig.dirname.length + 1;
      const matchPath = relPath.substring(prefixLength);
      if (ig.ignore.ignores(matchPath)) {
        return false;
      }
    }

    // Then check continueignore rules (these take precedence)
    for (const ig of continueIgnoreContexts) {
      const prefixLength = ig.dirname.length === 0 ? 0 : ig.dirname.length + 1;
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

  // returns a function which will optionally prefix a root path and fixup the paths for the appropriate OS filesystem (i.e. windows)
  // the reason to construct this function once is to avoid the need to call ide.pathSep() multiple times
  private async newPathFixupFunc(
    rootPath: string,
    ide: IDE,
  ): Promise<(relPath: string) => string> {
    const pathSep = await ide.pathSep();
    const prefix = rootPath === "" ? "" : rootPath + pathSep;
    if (pathSep === "/") {
      if (rootPath === "") {
        // return a no-op function in this case to avoid unnecessary string concatentation
        return (relPath: string) => relPath;
      }
      return (relPath: string) => prefix + relPath;
    }
    // this serves to 'fix-up' the path on Windows
    return (relPath: string) => {
      return prefix + relPath.split("/").join(pathSep);
    };
  }
}

const defaultOptions: WalkerOptions = {
  ignoreFiles: [".gitignore", ".continueignore"],
  additionalIgnoreRules: [...DEFAULT_IGNORE_DIRS, ...DEFAULT_IGNORE_FILETYPES],
};

export async function walkDir(
  path: string,
  ide: IDE,
  _options?: WalkerOptions,
): Promise<string[]> {
  let paths: string[] = [];
  for await (const p of walkDirAsync(path, ide, _options)) {
    paths.push(p);
  }
  return paths;
}

export async function* walkDirAsync(
  path: string,
  ide: IDE,
  _options?: WalkerOptions,
): AsyncGenerator<string> {
  const options = { ...defaultOptions, ..._options };
  yield* new DFSWalker(path, ide, options).walk();
}
