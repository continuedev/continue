import { Minimatch } from "minimatch";
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
  ignoreFiles: IgnoreFile[];
};

class IgnoreFile {
  private _rules: Minimatch[];

  constructor(
    public path: string,
    public content: string,
  ) {
    this.path = path;
    this.content = content;
    this._rules = this.contentToRules(content);
  }

  public get rules() {
    return this._rules;
  }

  private contentToRules(content: string): Minimatch[] {
    const options = {
      matchBase: true,
      dot: true,
      flipNegate: true,
      nocase: true,
    };
    return content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => !/^#|^$/.test(l))
      .map((l) => new Minimatch(l, options));
  }
}

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
      ignoreFiles: [],
    };
    const stack = [root];
    for (let cur = stack.pop(); cur; cur = stack.pop()) {
      const walkableEntries = await this.listDirForWalking(cur.walkableEntry);
      const ignoreFiles = await this.getIgnoreFilesToApplyInDir(
        cur.ignoreFiles,
        walkableEntries,
      );
      for (const w of walkableEntries) {
        if (!this.shouldInclude(w, ignoreFiles)) {
          continue;
        }
        if (this.entryIsDirectory(w.entry)) {
          stack.push({
            walkableEntry: w,
            ignoreFiles: ignoreFiles,
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

  private async getIgnoreFilesToApplyInDir(
    parentIgnoreFiles: IgnoreFile[],
    walkableEntries: WalkableEntry[],
  ): Promise<IgnoreFile[]> {
    const ignoreFilesInDir = await this.loadIgnoreFiles(walkableEntries);
    if (ignoreFilesInDir.length === 0) {
      return parentIgnoreFiles;
    }
    return Array.prototype.concat(parentIgnoreFiles, ignoreFilesInDir);
  }

  private async loadIgnoreFiles(
    entries: WalkableEntry[],
  ): Promise<IgnoreFile[]> {
    const ignoreEntries = entries.filter((w) => this.isIgnoreFile(w.entry));
    const promises = ignoreEntries.map(async (w) => {
      const content = await this.ide.readFile(w.absPath);
      return new IgnoreFile(w.relPath, content);
    });
    return Promise.all(promises);
  }

  private isIgnoreFile(e: Entry): boolean {
    const p = e[0];
    return this.ignoreFileNames.has(p);
  }

  private shouldInclude(
    walkableEntry: WalkableEntry,
    ignoreFiles: IgnoreFile[],
  ) {
    if (this.entryIsSymlink(walkableEntry.entry)) {
      // If called from the root, a symlink either links to a real file in this repository,
      // and therefore will be walked OR it linksto something outside of the repository and
      // we do not want to index it
      return false;
    }
    let relPath = walkableEntry.relPath;
    if (this.entryIsDirectory(walkableEntry.entry)) {
      if (defaultIgnoreDir.ignores(walkableEntry.relPath)) {
        return false;
      }
      relPath = `${relPath}/`;
    } else {
      if (this.options.onlyDirs) {
        return false;
      }
      if (defaultIgnoreFile.ignores(walkableEntry.relPath)) {
        return false;
      }
      relPath = `/${relPath}`;
    }
    let included = true;
    for (const ignoreFile of ignoreFiles) {
      for (const r of ignoreFile.rules) {
        if (r.negate === included) {
          // no need to test when the file is already NOT to be included unless this is a negate rule and vice versa
          continue;
        }
        if (r.match(relPath)) {
          included = r.negate;
        }
      }
    }
    return included;
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
  if (options?.returnRelativePaths) {
    return relativePaths;
  }
  const pathSep = await ide.pathSep();
  if (pathSep === "/") {
    return relativePaths.map((p) => path + pathSep + p);
  }
  return relativePaths.map((p) => path + pathSep + p.split("/").join(pathSep));
}
