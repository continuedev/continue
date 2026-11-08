import { IDE } from "core";
import { loadModelCatalog } from "core/config/providers/modelsFile";
import { loadProviderInstances } from "core/config/providers/providersFile";
import {
  checkConfigFile,
  configFileCompletions,
  configFileContext,
  ConfigFileContext,
  configFileKind,
  ConfigFileKind,
} from "core/config/yaml/configFileChecks";
import { getGlobalDirPath } from "core/util/paths";
import * as vscode from "vscode";

const DEBOUNCE_MS = 300;
const YAML_EXTENSION = "redhat.vscode-yaml";

/**
 * Editor support for Continuous's YAML files, in the extension host (the
 * VS Code API route the language server guide suggests for simple
 * features): problems from core's checks, kept as the file is typed, and
 * model and account names offered after `from:`, `connection:` and
 * `model:`. A change to models.yaml or providers.yaml re-checks every open
 * config, since the checks span files.
 */
export function registerConfigLanguageSupport(
  context: vscode.ExtensionContext,
  ide: IDE,
): void {
  const diagnostics = vscode.languages.createDiagnosticCollection("continuous");
  const timers = new Map<string, NodeJS.Timeout>();
  let cachedContext: Promise<ConfigFileContext> | undefined;
  const globalDir = getGlobalDirPath();

  const kindOf = (doc: vscode.TextDocument): ConfigFileKind | undefined =>
    doc.uri.scheme === "file" || doc.uri.scheme === "vscode-remote"
      ? configFileKind(doc.uri.fsPath, globalDir)
      : undefined;

  const otherFiles = (): Promise<ConfigFileContext> => {
    cachedContext ??= (async () => {
      const [catalog, accounts] = await Promise.all([
        loadModelCatalog(ide).catch(() => ({ models: [] })),
        loadProviderInstances(ide).catch(() => ({ providers: [] })),
      ]);
      return configFileContext(catalog.models, accounts.providers);
    })();
    return cachedContext;
  };

  const check = async (doc: vscode.TextDocument) => {
    const kind = kindOf(doc);
    if (!kind) {
      return;
    }
    const version = doc.version;
    const found = checkConfigFile(kind, doc.getText(), await otherFiles(), {
      // With the YAML extension, syntax and schema problems come from it
      // (package.json's yamlValidation); don't show them twice
      shapeChecks: !vscode.extensions.getExtension(YAML_EXTENSION),
    });
    if (doc.isClosed || doc.version !== version) {
      return;
    } // a newer check follows
    diagnostics.set(
      doc.uri,
      found.map((d) => {
        const range = new vscode.Range(
          d.range.start.line,
          d.range.start.character,
          d.range.end.line,
          d.range.end.character,
        );
        const diagnostic = new vscode.Diagnostic(
          range,
          d.message,
          d.severity === "error"
            ? vscode.DiagnosticSeverity.Error
            : vscode.DiagnosticSeverity.Warning,
        );
        diagnostic.source = "continuous";
        return diagnostic;
      }),
    );
  };

  const schedule = (doc: vscode.TextDocument) => {
    if (!kindOf(doc)) {
      return;
    }
    const key = doc.uri.toString();
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        void check(doc).catch((e) => console.warn("Could not check", key, e));
      }, DEBOUNCE_MS),
    );
  };

  /** models.yaml or providers.yaml changed: every open config may be affected. */
  const catalogChanged = () => {
    cachedContext = undefined;
    for (const doc of vscode.workspace.textDocuments) {
      schedule(doc);
    }
  };

  const isCatalogFile = (uri: vscode.Uri) => {
    const kind = configFileKind(uri.fsPath, globalDir);
    return kind === "models" || kind === "providers";
  };

  context.subscriptions.push(
    diagnostics,
    vscode.workspace.onDidOpenTextDocument(schedule),
    vscode.workspace.onDidChangeTextDocument((e) => schedule(e.document)),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (isCatalogFile(doc.uri)) {
        catalogChanged();
      }
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      clearTimeout(timers.get(doc.uri.toString()));
      diagnostics.delete(doc.uri);
    }),
    vscode.languages.registerCompletionItemProvider(
      { language: "yaml" },
      {
        async provideCompletionItems(doc, position) {
          const kind = kindOf(doc);
          if (!kind) {
            return undefined;
          }
          const line = doc
            .lineAt(position.line)
            .text.slice(0, position.character);
          const items = configFileCompletions(kind, line, await otherFiles());
          if (!items?.length) {
            return undefined;
          }
          // Replace the partly typed name, quotes excluded
          const typed = /["']?([^"':]*)$/.exec(line)?.[1] ?? "";
          const start = position.translate(0, -typed.trimStart().length);
          return items.map((c, i) => {
            const item = new vscode.CompletionItem(
              c.label,
              vscode.CompletionItemKind.Reference,
            );
            item.detail = c.detail;
            item.range = new vscode.Range(start, position);
            item.sortText = String(i).padStart(4, "0");
            return item;
          });
        },
      },
      ":",
      " ",
      "#",
    ),
  );

  // The catalog and accounts also change outside the editor (the GUI's
  // model setup writes them): watch both folders
  const watch = (base: vscode.Uri | vscode.WorkspaceFolder) => {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(base, "{models,providers}.yaml"),
    );
    watcher.onDidChange(catalogChanged);
    watcher.onDidCreate(catalogChanged);
    watcher.onDidDelete(catalogChanged);
    context.subscriptions.push(watcher);
  };
  watch(vscode.Uri.file(globalDir));
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    for (const dir of [".continuous", ".continue"]) {
      watch(vscode.Uri.joinPath(folder.uri, dir));
    }
  }

  for (const doc of vscode.workspace.textDocuments) {
    schedule(doc);
  }
}
