import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
import * as URI from "uri-js";
import * as YAML from "yaml";

import { ConfigYaml, DevEventName } from "@continuedev/config-yaml";
import * as JSONC from "comment-json";
import dotenv from "dotenv";

import { IdeType, SerializedContinueConfig } from "../";
import { defaultConfig } from "../config/default";
import Types from "../config/types";
import { editYamlText } from "./yamlEdit";

dotenv.config();

export function setConfigFilePermissions(filePath: string): void {
  try {
    if (os.platform() !== "win32") {
      fs.chmodSync(filePath, 0o600);
    }
  } catch (error) {
    console.warn(`Failed to set permissions on ${filePath}:`, error);
  }
}

/** The global folder's name in the home directory, and its name before 2.4.2. */
export const GLOBAL_DIR_NAME = ".continuous";
export const LEGACY_GLOBAL_DIR_NAME = ".continue";

/**
 * What a first start copies from ~/.continue: everything but what is rebuilt
 * on its own (the index, logs, dev data, downloaded tools and the compiled
 * config.ts). Of the index folder only globalContext.json is kept: it holds
 * the selected config, models and other choices, not index data.
 */
const NOT_COPIED_FROM_LEGACY_DIR = new Set([
  "index",
  "logs",
  "dev_data",
  ".utils",
  "node_modules",
  "out",
]);
const KEPT_FROM_LEGACY_INDEX = "globalContext.json";

function copiedFromLegacyDir(legacyDir: string, source: string): boolean {
  const relative = path.relative(legacyDir, source);
  if (relative === "") return true;
  const [top, ...rest] = relative.split(path.sep);
  if (top === "index") {
    return (
      rest.length === 0 ||
      (rest.length === 1 && rest[0] === KEPT_FROM_LEGACY_INDEX)
    );
  }
  return !NOT_COPIED_FROM_LEGACY_DIR.has(top);
}

/**
 * The copied globalContext.json names files by path or file URI (the selected
 * config, for one). Point those in the old folder at the same file in the new
 * one, so the choices still match.
 */
function repointGlobalContext(file: string, legacyDir: string, dir: string) {
  if (!fs.existsSync(file)) return;
  const forms = (p: string) => {
    const slashed = p.replace(/\\/g, "/");
    const uri = slashed.startsWith("/")
      ? `file://${slashed}`
      : `file:///${slashed}`;
    const encoded = encodeURI(uri);
    // VS Code writes a Windows drive as file:///c%3A/...
    const vscodeUri = encoded.replace(
      /^file:\/\/\/([A-Za-z]):/,
      (_, drive: string) => `file:///${drive.toLowerCase()}%3A`,
    );
    return [JSON.stringify(p).slice(1, -1), slashed, uri, encoded, vscodeUri];
  };
  const from = forms(legacyDir);
  const to = forms(dir);
  let text = fs.readFileSync(file, "utf8");
  from.forEach((f, i) => {
    text = text.split(f).join(to[i]);
  });
  fs.writeFileSync(file, text);
}

/**
 * Copy ~/.continue to ~/.continuous when only the old one exists. The copy
 * goes to a temporary folder first and is renamed into place, so a failed
 * copy leaves no half-made ~/.continuous. The old folder is not changed: the
 * Continue extension and its CLI keep using it. Returns the folder to use.
 */
export function migrateLegacyGlobalDir(legacyDir: string, dir: string): string {
  if (fs.existsSync(dir) || !fs.existsSync(legacyDir)) return dir;
  const partial = `${dir}.partial-${process.pid}`;
  try {
    fs.cpSync(legacyDir, partial, {
      recursive: true,
      filter: (source) => copiedFromLegacyDir(legacyDir, source),
    });
    repointGlobalContext(
      path.join(partial, "index", KEPT_FROM_LEGACY_INDEX),
      legacyDir,
      dir,
    );
    fs.renameSync(partial, dir);
    return dir;
  } catch (error) {
    console.warn(`Could not copy ${legacyDir} to ${dir}`, error);
    fs.rmSync(partial, { recursive: true, force: true });
    // Another window may have made it in the meantime
    return fs.existsSync(dir) ? dir : legacyDir;
  }
}

const CONTINUE_GLOBAL_DIR = (() => {
  const configPath =
    process.env.CONTINUOUS_GLOBAL_DIR || process.env.CONTINUE_GLOBAL_DIR;
  if (configPath) {
    // Convert relative path to absolute paths based on current working directory
    return path.isAbsolute(configPath)
      ? configPath
      : path.resolve(process.cwd(), configPath);
  }
  return migrateLegacyGlobalDir(
    path.join(os.homedir(), LEGACY_GLOBAL_DIR_NAME),
    path.join(os.homedir(), GLOBAL_DIR_NAME),
  );
})();

// export const DEFAULT_CONFIG_TS_CONTENTS = `import { Config } from "./types"\n\nexport function modifyConfig(config: Config): Config {
//   return config;
// }`;

export const DEFAULT_CONFIG_TS_CONTENTS = `export function modifyConfig(config: Config): Config {
  return config;
}`;

export function getChromiumPath(): string {
  return path.join(getContinueUtilsPath(), ".chromium-browser-snapshots");
}

export function getContinueUtilsPath(): string {
  const utilsPath = path.join(getContinueGlobalPath(), ".utils");
  if (!fs.existsSync(utilsPath)) {
    fs.mkdirSync(utilsPath);
  }
  return utilsPath;
}

export function getGlobalContinueIgnorePath(): string {
  const ignorePath = path.join(getContinueGlobalPath(), ".continuousignore");
  if (!fs.existsSync(ignorePath)) {
    // A folder copied from ~/.continue has the file under its old name
    const legacy = path.join(getContinueGlobalPath(), ".continueignore");
    fs.writeFileSync(
      ignorePath,
      fs.existsSync(legacy) ? fs.readFileSync(legacy) : "",
    );
  }
  return ignorePath;
}

/** The global folder's path, without creating it. */
export function getGlobalDirPath(): string {
  return CONTINUE_GLOBAL_DIR;
}

export function getContinueGlobalPath(): string {
  // ~/.continuous, or CONTINUOUS_GLOBAL_DIR
  const continuePath = CONTINUE_GLOBAL_DIR;
  if (!fs.existsSync(continuePath)) {
    // recursive: no EEXIST when another process makes it first
    fs.mkdirSync(continuePath, { recursive: true });
  }
  return continuePath;
}

export function getSessionsFolderPath(): string {
  const sessionsPath = path.join(getContinueGlobalPath(), "sessions");
  if (!fs.existsSync(sessionsPath)) {
    fs.mkdirSync(sessionsPath);
  }
  return sessionsPath;
}

export function getIndexFolderPath(): string {
  const indexPath = path.join(getContinueGlobalPath(), "index");
  if (!fs.existsSync(indexPath)) {
    fs.mkdirSync(indexPath);
  }
  return indexPath;
}

export function getGlobalContextFilePath(): string {
  return path.join(getIndexFolderPath(), "globalContext.json");
}

export function getSharedConfigFilePath(): string {
  return path.join(getContinueGlobalPath(), "sharedConfig.json");
}

export function getSessionFilePath(sessionId: string): string {
  return path.join(getSessionsFolderPath(), `${sessionId}.json`);
}

export function getSessionsListPath(): string {
  const filepath = path.join(getSessionsFolderPath(), "sessions.json");
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, JSON.stringify([]));
  }
  return filepath;
}

export function getConfigJsonPath(): string {
  const p = path.join(getContinueGlobalPath(), "config.json");
  return p;
}

export function getConfigYamlPath(ideType?: IdeType): string {
  const p = path.join(getContinueGlobalPath(), "config.yaml");
  const exists = fs.existsSync(p);
  const isEmpty = exists && fs.readFileSync(p, "utf8").trim() === "";
  const needsCreation = !exists && !fs.existsSync(getConfigJsonPath());

  if (needsCreation || isEmpty) {
    fs.writeFileSync(p, YAML.stringify(defaultConfig));
    setConfigFilePermissions(p);
  }
  return p;
}

export function getPrimaryConfigFilePath(): string {
  const configYamlPath = getConfigYamlPath();
  if (fs.existsSync(configYamlPath)) {
    return configYamlPath;
  }
  return getConfigJsonPath();
}

export function getConfigTsPath(): string {
  const p = path.join(getContinueGlobalPath(), "config.ts");
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, DEFAULT_CONFIG_TS_CONTENTS);
  }

  const typesPath = path.join(getContinueGlobalPath(), "types");
  if (!fs.existsSync(typesPath)) {
    fs.mkdirSync(typesPath);
  }
  const corePath = path.join(typesPath, "core");
  if (!fs.existsSync(corePath)) {
    fs.mkdirSync(corePath);
  }
  const packageJsonPath = path.join(getContinueGlobalPath(), "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify({
        name: "continuous-config",
        version: "1.0.0",
        description: "My Continuous Configuration",
        main: "config.js",
      }),
    );
  }

  fs.writeFileSync(path.join(corePath, "index.d.ts"), Types);
  return p;
}

export function getConfigJsPath(): string {
  // Do not create automatically
  return path.join(getContinueGlobalPath(), "out", "config.js");
}

export function getTsConfigPath(): string {
  const tsConfigPath = path.join(getContinueGlobalPath(), "tsconfig.json");
  if (!fs.existsSync(tsConfigPath)) {
    fs.writeFileSync(
      tsConfigPath,
      JSON.stringify(
        {
          compilerOptions: {
            target: "ESNext",
            useDefineForClassFields: true,
            lib: ["DOM", "DOM.Iterable", "ESNext"],
            allowJs: true,
            skipLibCheck: true,
            esModuleInterop: false,
            allowSyntheticDefaultImports: true,
            strict: true,
            forceConsistentCasingInFileNames: true,
            module: "System",
            moduleResolution: "Node",
            noEmit: false,
            noEmitOnError: false,
            outFile: "./out/config.js",
            typeRoots: ["./node_modules/@types", "./types"],
          },
          include: ["./config.ts"],
        },
        null,
        2,
      ),
    );
  }
  return tsConfigPath;
}

export function getContinueRcPath(): string {
  // Disable indexing of the config folder to prevent infinite loops
  const continuercPath = path.join(
    getContinueGlobalPath(),
    ".continuousrc.json",
  );
  if (!fs.existsSync(continuercPath)) {
    fs.writeFileSync(
      continuercPath,
      JSON.stringify(
        {
          disableIndexing: true,
        },
        null,
        2,
      ),
    );
  }
  return continuercPath;
}

function getDevDataPath(): string {
  const sPath = path.join(getContinueGlobalPath(), "dev_data");
  if (!fs.existsSync(sPath)) {
    fs.mkdirSync(sPath);
  }
  return sPath;
}

export function getDevDataSqlitePath(): string {
  return path.join(getDevDataPath(), "devdata.sqlite");
}

export function getDevDataFilePath(
  eventName: DevEventName,
  schema: string,
): string {
  const versionPath = path.join(getDevDataPath(), schema);
  if (!fs.existsSync(versionPath)) {
    fs.mkdirSync(versionPath);
  }
  return path.join(versionPath, `${String(eventName)}.jsonl`);
}

function editConfigJson(
  callback: (config: SerializedContinueConfig) => SerializedContinueConfig,
): void {
  const config = fs.readFileSync(getConfigJsonPath(), "utf8");
  let configJson = JSONC.parse(config);
  // Check if it's an object
  if (typeof configJson === "object" && configJson !== null) {
    configJson = callback(configJson as any) as any;
    fs.writeFileSync(getConfigJsonPath(), JSONC.stringify(configJson, null, 2));
  } else {
    console.warn("config.json is not a valid object");
  }
}

/**
 * The config file GUI edits go to: the selected config, when it is a local
 * YAML file other than the main config.yaml. `undefined` means the main
 * config (config.yaml, or config.json for older setups); `null` means the
 * selected config cannot be edited here (e.g. a file on a remote host), so
 * edits are refused rather than written to a config the user is not using.
 */
let selectedConfigFile: string | null | undefined = undefined;

/**
 * Called when the selected config changes. `uri` is the selected profile's
 * file, or undefined for the main config.
 */
export function setSelectedConfigFile(uri: string | undefined): void {
  if (!uri) {
    selectedConfigFile = undefined;
    return;
  }
  if (!uri.startsWith("file://")) {
    selectedConfigFile = null;
    return;
  }
  try {
    selectedConfigFile = fileURLToPath(uri);
  } catch {
    selectedConfigFile = null;
  }
}

/**
 * The YAML file that GUI edits change, or undefined when there is none
 * (a config.json setup, or a selected config that is not a local file).
 */
export function getEditableConfigYamlPath(): string | undefined {
  if (selectedConfigFile === null) return undefined;
  if (selectedConfigFile !== undefined) {
    return fs.existsSync(selectedConfigFile) ? selectedConfigFile : undefined;
  }
  const p = getConfigYamlPath();
  return fs.existsSync(p) ? p : undefined;
}

/** Where an edit goes: the selected config (default) or the main config. */
export type ConfigEditTarget = "selected" | "main";

function editConfigYaml(
  callback: (config: ConfigYaml) => ConfigYaml,
  configPath: string,
): void {
  const source = fs.readFileSync(configPath, "utf8");
  // Edit the parsed document so comments and key order survive. The old
  // parse -> stringify round trip dropped every comment on each GUI save.
  const { text, error } = editYamlText<ConfigYaml>(source, callback);
  if (error) {
    console.warn(`Not editing ${path.basename(configPath)}: ${error}`);
    return;
  }
  if (text === undefined) return; // nothing changed, skip the write

  // Keep one copy from before the first GUI edit, for users who version the file.
  // Only for files in ~/.continuous: a .bak next to a workspace config would
  // end up in the user's repository.
  const backupPath = `${configPath}.bak`;
  const rel = path.relative(getContinueGlobalPath(), configPath);
  const inGlobalDir = !rel.startsWith("..") && !path.isAbsolute(rel);
  if (inGlobalDir && !fs.existsSync(backupPath)) {
    try {
      fs.writeFileSync(backupPath, source);
      setConfigFilePermissions(backupPath);
    } catch (e) {
      console.warn(`Could not write ${backupPath}:`, e);
    }
  }
  writeFileAtomically(configPath, text);
}

/**
 * Write via a temp file and rename, so a crash mid-write cannot leave a
 * truncated config.yaml. A symlinked config (common with dotfiles repos) is
 * written through to its real target, so the link survives.
 */
function writeFileAtomically(filePath: string, text: string): void {
  let target = filePath;
  try {
    target = fs.realpathSync(filePath);
  } catch {
    // Does not exist yet; write the path as given.
  }
  const tmp = `${target}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, text);
    setConfigFilePermissions(tmp);
    fs.renameSync(tmp, target);
  } catch (e) {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      // Nothing more to clean up.
    }
    // Windows refuses to replace a file another process has open (an editor,
    // antivirus or indexer): EPERM/EBUSY/EACCES. Losing the user's edit is
    // worse than a non-atomic write, so fall back to writing in place.
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "EPERM" || code === "EBUSY" || code === "EACCES") {
      fs.writeFileSync(target, text);
    } else {
      throw e;
    }
  }
  setConfigFilePermissions(target);
}

export function editConfigFile(
  configJsonCallback: (
    config: SerializedContinueConfig,
  ) => SerializedContinueConfig,
  configYamlCallback: (config: ConfigYaml) => ConfigYaml,
  target: ConfigEditTarget = "selected",
): void {
  if (target === "selected" && selectedConfigFile !== undefined) {
    const file = getEditableConfigYamlPath();
    if (file) editConfigYaml(configYamlCallback, file);
    return;
  }
  const yamlPath = getConfigYamlPath();
  if (fs.existsSync(yamlPath)) {
    editConfigYaml(configYamlCallback, yamlPath);
  } else if (fs.existsSync(getConfigJsonPath())) {
    editConfigJson(configJsonCallback);
  }
}

function getMigrationsFolderPath(): string {
  const migrationsPath = path.join(getContinueGlobalPath(), ".migrations");
  if (!fs.existsSync(migrationsPath)) {
    fs.mkdirSync(migrationsPath);
  }
  return migrationsPath;
}

export async function migrate(
  id: string,
  callback: () => void | Promise<void>,
  onAlreadyComplete?: () => void,
) {
  if (process.env.NODE_ENV === "test") {
    return await Promise.resolve(callback());
  }

  const migrationsPath = getMigrationsFolderPath();
  const migrationPath = path.join(migrationsPath, id);

  if (!fs.existsSync(migrationPath)) {
    try {
      console.log(`Running migration: ${id}`);

      fs.writeFileSync(migrationPath, "");
      await Promise.resolve(callback());
    } catch (e) {
      console.warn(`Migration ${id} failed`, e);
    }
  } else if (onAlreadyComplete) {
    onAlreadyComplete();
  }
}

export function getIndexSqlitePath(): string {
  return path.join(getIndexFolderPath(), "index.sqlite");
}

export function getLanceDbPath(): string {
  return path.join(getIndexFolderPath(), "lancedb");
}

export function getTabAutocompleteCacheSqlitePath(): string {
  return path.join(getIndexFolderPath(), "autocompleteCache.sqlite");
}

export function getDocsSqlitePath(): string {
  return path.join(getIndexFolderPath(), "docs.sqlite");
}

export function getRemoteConfigsFolderPath(): string {
  const dir = path.join(getContinueGlobalPath(), ".configs");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  return dir;
}

export function getPathToRemoteConfig(remoteConfigServerUrl: string): string {
  let url: URL | undefined = undefined;
  try {
    url =
      typeof remoteConfigServerUrl !== "string" || remoteConfigServerUrl === ""
        ? undefined
        : new URL(remoteConfigServerUrl);
  } catch (e) {}
  const dir = path.join(getRemoteConfigsFolderPath(), url?.hostname ?? "None");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  return dir;
}

export function getConfigJsonPathForRemote(
  remoteConfigServerUrl: string,
): string {
  return path.join(getPathToRemoteConfig(remoteConfigServerUrl), "config.json");
}

export function getConfigJsPathForRemote(
  remoteConfigServerUrl: string,
): string {
  return path.join(getPathToRemoteConfig(remoteConfigServerUrl), "config.js");
}

export function getContinueDotEnv(): { [key: string]: string } {
  const filepath = path.join(getContinueGlobalPath(), ".env");
  if (fs.existsSync(filepath)) {
    return dotenv.parse(fs.readFileSync(filepath));
  }
  return {};
}

export function getLogsDirPath(): string {
  const logsPath = path.join(getContinueGlobalPath(), "logs");
  if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath);
  }
  return logsPath;
}

export function getCoreLogsPath(): string {
  return path.join(getLogsDirPath(), "core.log");
}

export function getPromptLogsPath(): string {
  return path.join(getLogsDirPath(), "prompt.log");
}

export function getGlobalFolderWithName(name: string): string {
  return path.join(getContinueGlobalPath(), name);
}

export function getGlobalPromptsPath(): string {
  return getGlobalFolderWithName("prompts");
}

export function readAllGlobalPromptFiles(
  folderPath: string = getGlobalPromptsPath(),
): { path: string; content: string }[] {
  if (!fs.existsSync(folderPath)) {
    return [];
  }
  const files = fs.readdirSync(folderPath);
  const promptFiles: { path: string; content: string }[] = [];
  files.forEach((file) => {
    const filepath = path.join(folderPath, file);
    const stats = fs.statSync(filepath);

    if (stats.isDirectory()) {
      const nestedPromptFiles = readAllGlobalPromptFiles(filepath);
      promptFiles.push(...nestedPromptFiles);
    } else if (file.endsWith(".prompt")) {
      const content = fs.readFileSync(filepath, "utf8");
      promptFiles.push({ path: filepath, content });
    }
  });

  return promptFiles;
}

export function getRepoMapFilePath(): string {
  return path.join(getContinueUtilsPath(), "repo_map.txt");
}

export function getEsbuildBinaryPath(): string {
  return path.join(getContinueUtilsPath(), "esbuild");
}

export function migrateV1DevDataFiles() {
  const devDataPath = getDevDataPath();
  function moveToV1FolderIfExists(
    oldFileName: string,
    newFileName: DevEventName,
  ) {
    const oldFilePath = path.join(devDataPath, `${oldFileName}.jsonl`);
    if (fs.existsSync(oldFilePath)) {
      const newFilePath = getDevDataFilePath(newFileName, "0.1.0");
      if (!fs.existsSync(newFilePath)) {
        fs.copyFileSync(oldFilePath, newFilePath);
        fs.unlinkSync(oldFilePath);
      }
    }
  }
  moveToV1FolderIfExists("tokens_generated", "tokensGenerated");
  moveToV1FolderIfExists("chat", "chatFeedback");
  moveToV1FolderIfExists("quickEdit", "quickEdit");
  moveToV1FolderIfExists("autocomplete", "autocomplete");
}

export function getLocalEnvironmentDotFilePath(): string {
  return path.join(getContinueGlobalPath(), ".local");
}

export function getStagingEnvironmentDotFilePath(): string {
  return path.join(getContinueGlobalPath(), ".staging");
}

export function getDiffsDirectoryPath(): string {
  const diffsPath = path.join(getContinueGlobalPath(), ".diffs"); // .replace(/^C:/, "c:"); ??
  if (!fs.existsSync(diffsPath)) {
    fs.mkdirSync(diffsPath, {
      recursive: true,
    });
  }
  return diffsPath;
}

export const isFileWithinFolder = (
  fileUri: string,
  folderPath: string,
): boolean => {
  try {
    if (!fileUri || !folderPath) {
      return false;
    }

    const fileUriParsed = URI.parse(fileUri);
    const fileScheme = fileUriParsed.scheme || "file";
    let filePath = fileUriParsed.path || "";
    filePath = decodeURIComponent(filePath);

    let folderWithScheme = folderPath;
    if (!folderPath.includes("://")) {
      folderWithScheme = `${fileScheme}://${folderPath.startsWith("/") ? "" : "/"}${folderPath}`;
    }
    const folderUriParsed = URI.parse(folderWithScheme);

    let folderPathClean = folderUriParsed.path || "";
    folderPathClean = decodeURIComponent(folderPathClean);

    filePath = filePath.replace(/\/$/, "");
    folderPathClean = folderPathClean.replace(/\/$/, "");

    return (
      filePath === folderPathClean || filePath.startsWith(`${folderPathClean}/`)
    );
  } catch (error) {
    console.error("Error in isFileWithinFolder:", error);
    return false;
  }
};
