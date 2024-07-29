import ignore, { Ignore } from "ignore";
import path from "node:path";
import { FileType, IDE } from "../index.d.js";
import {
  DEFAULT_IGNORE_DIRS,
  DEFAULT_IGNORE_FILETYPES,
  defaultIgnoreDir,
  defaultIgnoreFile,
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
  ignore: Ignore;
};

class DFSWalker {
  private readonly path: string;
  private readonly ide: IDE;
  private readonly options: WalkerOptions;
  private readonly ignoreFileNames: Set<string>;

  constructor(path: string, ide: IDE, options: WalkerOptions) {
    this.path = path;
    this.ide = ide;
    this.options = options;
    this.ignoreFileNames = new Set<string>(options.ignoreFiles);
  }

  // walk is a depth-first search implementation
  public async *walk(): AsyncGenerator<string> {
    const root: WalkContext = {
      walkableEntry: {
        relPath: "",
        absPath: this.path,
        type: 2 as FileType.Directory,
        entry: ["", 2 as FileType.Directory],
      },
      ignore: ignore().add(defaultIgnoreDir).add(defaultIgnoreFile),
    };
    const stack = [root];
    for (let cur = stack.pop(); cur; cur = stack.pop()) {
      const walkableEntries = await this.listDirForWalking(cur.walkableEntry);
      const ignore = await this.getIgnoreToApplyInDir(
        cur.ignore,
        walkableEntries,
      );
      for (const w of walkableEntries) {
        if (!this.shouldInclude(w, ignore)) {
          continue;
        }
        if (this.entryIsDirectory(w.entry)) {
          stack.push({
            walkableEntry: w,
            ignore: ignore,
          });
          if (this.options.onlyDirs) {
            // when onlyDirs is enabled the walker will only return directory names
            yield w.relPath;
          }
        } else {
          yield w.relPath;
        }
      }
    }
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
    parentIgnore: Ignore,
    walkableEntries: WalkableEntry[],
  ): Promise<Ignore> {
    const ignoreFilesInDir = await this.loadIgnoreFiles(walkableEntries);
    if (ignoreFilesInDir.length === 0) {
      return parentIgnore;
    }
    const patterns = ignoreFilesInDir
      .map((c) => {
        return c
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => !/^#|^$/.test(l));
      })
      .flat();
    return ignore().add(parentIgnore).add(patterns);
  }

  private async loadIgnoreFiles(entries: WalkableEntry[]): Promise<string[]> {
    const ignoreEntries = entries.filter((w) => this.isIgnoreFile(w.entry));
    const promises = ignoreEntries.map(async (w) => {
      return await this.ide.readFile(w.absPath);
    });
    return Promise.all(promises);
  }

  private isIgnoreFile(e: Entry): boolean {
    const p = e[0];
    return this.ignoreFileNames.has(p);
  }

  private shouldInclude(walkableEntry: WalkableEntry, ignore: Ignore) {
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
    return !ignore.ignores(relPath);
  }

  private entryIsDirectory(entry: Entry) {
    return entry[1] === (2 as FileType.Directory);
  }

  private entryIsSymlink(entry: Entry) {
    return entry[1] === (64 as FileType.SymbolicLink);
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
  let entries: string[] = [];
  const options = { ...defaultOptions, ..._options };
  const dfsWalker = new DFSWalker(path, ide, options);
  let relativePaths: string[] = [];
  for await (const e of dfsWalker.walk()) {
    relativePaths.push(e);
  }
  const pathSep = await ide.pathSep();
  const prefix = options.returnRelativePaths ? "" : path + pathSep;

  if (pathSep === "/") {
    return relativePaths.map((p) => prefix + p);
  }
  return relativePaths.map((p) => prefix + p.split("/").join(pathSep));
}
