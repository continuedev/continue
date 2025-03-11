import ignore, { Ignore } from "ignore";

import type { FileType, IDE } from "..";

import { joinPathsToUri } from "../util/uri";
import {
  defaultIgnoreFileAndDir,
  getGlobalContinueIgArray,
  gitIgArrayFromFile,
} from "./ignore";

export interface WalkerOptions {
  onlyDirs?: boolean;
  returnRelativeUrisPaths?: boolean;
  source?: string;
}

type Entry = [string, FileType];

const LIST_DIR_CACHE_TIME = 30_000; // 30 seconds
const IGNORE_FILE_CACHE_TIME = 30_000; // 30 seconds

// helper struct used for the DFS walk
type WalkableEntry = {
  name: string;
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

class WalkDirCache {
  dirListCache: Map<
    string,
    {
      time: number;
      entries: Promise<[string, FileType][]>;
    }
  > = new Map();
  dirIgnoreCache: Map<
    string,
    {
      time: number;
      ignore: Promise<Ignore>;
    }
  > = new Map();
  // The super safe approach for now
  invalidate() {
    this.dirListCache.clear();
    this.dirIgnoreCache.clear();
  }
  // invalidateIgnore(uri: string) {
  //   this.dirIgnoreCache.delete(uri);
  // }
  // invalidateParent(uri: string) {
  //   const splitUri = fileUri.split("/");
  //   splitUri.pop();
  //   const parent = splitUri.join("/");
  //   this.dirListCache.delete(uri);
  // }
}
export const walkDirCache = new WalkDirCache(); // TODO - singleton approach better?

class DFSWalker {
  constructor(
    private readonly uri: string,
    private readonly ide: IDE,
    private readonly options: WalkerOptions,
  ) {}

  // walk is a depth-first search implementation
  public async *walk(): AsyncGenerator<string> {
    const start = Date.now();
    let ignoreFileTime = 0;
    let ignoreTime = 0;
    let listDirTime = 0;
    let dirs = 0;
    let listDirCacheHits = 0;
    let ignoreCacheHits = 0;

    let section = Date.now();
    const defaultAndGlobalIgnores = ignore()
      .add(defaultIgnoreFileAndDir)
      .add(getGlobalContinueIgArray());
    ignoreFileTime += Date.now() - section;

    const rootContext: WalkContext = {
      walkableEntry: {
        name: "",
        relativeUriPath: "",
        uri: this.uri,
        type: 2 as FileType.Directory,
        entry: ["", 2 as FileType.Directory],
      },
      ignoreContexts: [],
    };
    const stack = [rootContext];

    for (let cur = stack.pop(); cur; cur = stack.pop()) {
      // Previous no caching approach:
      // const entries = await this.ide.listDir(cur.walkableEntry.uri);
      // const newIgnore = await getIgnoreContext(
      //   cur.walkableEntry.uri,
      //   entries,
      //   this.ide,
      //   defaultAndGlobalIgnores,
      // );

      // Only directories will be added to the stack
      dirs++;

      section = Date.now();
      let entries: [string, FileType][] = [];
      const cachedListdir = walkDirCache.dirListCache.get(
        cur.walkableEntry.uri,
      );
      if (
        cachedListdir &&
        cachedListdir.time > Date.now() - LIST_DIR_CACHE_TIME
      ) {
        entries = await cachedListdir.entries;
        listDirCacheHits++;
      } else {
        const promise = this.ide.listDir(cur.walkableEntry.uri);
        walkDirCache.dirListCache.set(cur.walkableEntry.uri, {
          time: Date.now(),
          entries: promise,
        });
        entries = await promise;
      }
      listDirTime += Date.now() - section;

      section = Date.now();
      let newIgnore: Ignore;
      const cachedIgnore = walkDirCache.dirIgnoreCache.get(
        cur.walkableEntry.uri,
      );
      if (
        cachedIgnore &&
        cachedIgnore.time > Date.now() - IGNORE_FILE_CACHE_TIME
      ) {
        newIgnore = await cachedIgnore.ignore;
        ignoreCacheHits++;
      } else {
        const ignorePromise = getIgnoreContext(
          cur.walkableEntry.uri,
          entries,
          this.ide,
          defaultAndGlobalIgnores,
        );
        walkDirCache.dirIgnoreCache.set(cur.walkableEntry.uri, {
          time: Date.now(),
          ignore: ignorePromise,
        });
        newIgnore = await ignorePromise;
      }

      const ignoreContexts = [
        ...cur.ignoreContexts,
        {
          ignore: newIgnore,
          dirname: cur.walkableEntry.relativeUriPath,
        },
      ];
      ignoreFileTime += Date.now() - section;

      for (const entry of entries) {
        if (this.entryIsSymlink(entry)) {
          // If called from the root, a symlink either links to a real file in this repository,
          // and therefore will be walked OR it links to something outside of the repository and
          // we do not want to index it
          continue;
        }
        const walkableEntry = {
          name: entry[0],
          relativeUriPath: `${cur.walkableEntry.relativeUriPath}${cur.walkableEntry.relativeUriPath ? "/" : ""}${entry[0]}`,
          uri: joinPathsToUri(cur.walkableEntry.uri, entry[0]),
          type: entry[1],
          entry: entry,
        };

        let relPath = walkableEntry.relativeUriPath;
        if (this.entryIsDirectory(entry)) {
          relPath = `${relPath}/`;
        } else {
          if (this.options.onlyDirs) {
            continue;
          }
        }
        let shouldIgnore = false;
        for (const ig of ignoreContexts) {
          if (shouldIgnore) {
            continue;
          }
          // remove the directory name and path separator from the match path, unless this an ignore file
          // in the root directory
          const prefixLength =
            ig.dirname.length === 0 ? 0 : ig.dirname.length + 1;
          // The ignore library expects a path relative to the ignore file location
          const matchPath = relPath.substring(prefixLength);
          section = Date.now();
          if (ig.ignore.ignores(matchPath)) {
            shouldIgnore = true;
          }
          ignoreTime += Date.now() - section;
        }
        if (shouldIgnore) {
          continue;
        }

        if (this.entryIsDirectory(entry)) {
          stack.push({
            walkableEntry,
            ignoreContexts,
          });
          if (this.options.onlyDirs) {
            // when onlyDirs is enabled the walker will only return directory names
            if (this.options.returnRelativeUrisPaths) {
              yield walkableEntry.relativeUriPath;
            } else {
              yield walkableEntry.uri;
            }
          }
        } else {
          if (this.options.returnRelativeUrisPaths) {
            yield walkableEntry.relativeUriPath;
          } else {
            yield walkableEntry.uri;
          }
        }
      }
    }
    // console.log(
    //   `Walk Dir Result:\nSource: ${this.options.source ?? "unknown"}\nDir: ${this.uri}\nDuration: ${Date.now() - start}ms:\n\tList dir: ${listDirTime}ms (${listDirCacheHits}/${dirs} cache hits)\n\tIgnore files: ${ignoreFileTime}ms (${ignoreCacheHits}/${dirs} cache hits)\n\tIgnoring: ${ignoreTime}ms`,
    // );
  }

  private entryIsDirectory(entry: Entry) {
    return entry[1] === (2 as FileType.Directory);
  }

  private entryIsSymlink(entry: Entry) {
    return entry[1] === (64 as FileType.SymbolicLink);
  }
}

const defaultOptions: WalkerOptions = {
  onlyDirs: false,
  returnRelativeUrisPaths: false,
};

export async function* walkDirAsync(
  path: string,
  ide: IDE,
  _optionOverrides?: WalkerOptions,
): AsyncGenerator<string> {
  const options = { ...defaultOptions, ..._optionOverrides };
  yield* new DFSWalker(path, ide, options).walk();
}

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

export async function getIgnoreContext(
  currentDir: string,
  currentDirEntries: Entry[],
  ide: IDE,
  defaultAndGlobalIgnores: Ignore,
) {
  const dirFiles = currentDirEntries
    .filter(([_, entryType]) => entryType === (1 as FileType.File))
    .map(([name, _]) => name);

  // Find ignore files and get ignore arrays from their contexts
  // These are done separately so that .continueignore can override .gitignore
  const gitIgnoreFile = dirFiles.find((name) => name === ".gitignore");
  const continueIgnoreFile = dirFiles.find(
    (name) => name === ".continueignore",
  );

  const getGitIgnorePatterns = async () => {
    if (gitIgnoreFile) {
      const contents = await ide.readFile(`${currentDir}/.gitignore`);
      return gitIgArrayFromFile(contents);
    }
    return [];
  };
  const getContinueIgnorePatterns = async () => {
    if (continueIgnoreFile) {
      const contents = await ide.readFile(`${currentDir}/.continueignore`);
      return gitIgArrayFromFile(contents);
    }
    return [];
  };

  const ignoreArrays = await Promise.all([
    getGitIgnorePatterns(),
    getContinueIgnorePatterns(),
  ]);

  if (ignoreArrays[0].length === 0 && ignoreArrays[1].length === 0) {
    return defaultAndGlobalIgnores;
  }

  // Note precedence here!
  const ignoreContext = ignore()
    .add(ignoreArrays[0]) // gitignore
    .add(defaultAndGlobalIgnores) // default file/folder ignores followed by global .continueignore - this is combined for speed
    .add(ignoreArrays[1]); // local .continueignore

  return ignoreContext;
}
