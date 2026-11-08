import type {
  McpImportPreviewServer,
  McpImportPreviewSource,
  McpImportResult,
} from "core/config/importClineMcp";
import { useContext, useEffect, useState } from "react";
import { Button } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch } from "../../../redux/hooks";
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";

const SKIP_LABELS: Record<string, string> = {
  duplicate: "already configured",
  disabled: "disabled in the source",
  invalid: "invalid entry",
  "unsupported-transport": "unsupported transport",
};

function ImportDialog({ sources }: { sources: McpImportPreviewSource[] }) {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();

  const [sourcePath, setSourcePath] = useState(sources[0].path);
  const source = sources.find((s) => s.path === sourcePath) ?? sources[0];
  const importable = source.servers.filter((s) => s.status === "new");
  const skipped = source.servers.filter((s) => s.status !== "new");

  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [storeSecrets, setStoreSecrets] = useState(true);
  const [secureAvailable, setSecureAvailable] = useState(false);
  const [useSecure, setUseSecure] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<McpImportResult>();

  useEffect(() => {
    void ideMessenger
      .request("config/getProviderSetup", undefined)
      .then((res) => {
        if (res.status === "success") {
          setSecureAvailable(res.content.secureStorageAvailable);
          setUseSecure(res.content.preferredKeyStorage === "secure");
        }
      })
      .catch(() => {});
  }, [ideMessenger]);

  const chosen = importable.filter((s) => !unchecked.has(s.name));
  const secretNames = chosen.flatMap((s) => s.secretNames);

  function close() {
    dispatch(setShowDialog(false));
    dispatch(setDialogMessage(undefined));
  }

  async function runImport() {
    setBusy(true);
    try {
      const res = await ideMessenger.request("config/importMcpServers", {
        sourcePath: source.path,
        names: chosen.map((s) => s.name),
        storeSecrets,
        storage: secureAvailable && useSecure ? "secure" : "env",
      });
      setResult(
        res.status === "success"
          ? res.content
          : {
              imported: [],
              skipped: [],
              secretsStored: [],
              secretsPending: [],
              warnings: [],
              error: res.error,
            },
      );
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="p-4 pt-0">
        <h1 className="mb-2 text-center text-xl">Import MCP servers</h1>
        {result.error ? (
          <p className="text-sm text-error">{result.error}</p>
        ) : (
          <p className="text-sm">
            Imported {result.imported.length} server
            {result.imported.length === 1 ? "" : "s"}:{" "}
            {result.imported.join(", ")}.
          </p>
        )}
        {result.secretsStored.length > 0 && (
          <p className="text-sm">
            Stored {result.secretsStored.length} credential
            {result.secretsStored.length === 1 ? "" : "s"}.
          </p>
        )}
        {result.secretsPending.length > 0 && (
          <p className="text-sm text-warning">
            Still needs a value: {result.secretsPending.join(", ")}. Add them in
            ~/.continuous/.env or through secure storage.
          </p>
        )}
        {result.warnings.map((w) => (
          <p key={w} className="text-xs text-warning">
            {w}
          </p>
        ))}
        <div className="flex justify-end">
          <Button onClick={close}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pt-0">
      <h1 className="mb-2 text-center text-xl">Import MCP servers</h1>
      {sources.length > 1 && (
        <select
          className="mb-2 w-full"
          value={sourcePath}
          onChange={(e) => {
            setSourcePath(e.target.value);
            setUnchecked(new Set());
          }}
        >
          {sources.map((s) => (
            <option key={s.path} value={s.path}>
              {s.label}
            </option>
          ))}
        </select>
      )}
      <p className="mb-2 text-xs break-all text-description">{source.path}</p>

      {source.error && <p className="text-sm text-error">{source.error}</p>}
      {importable.length === 0 && !source.error && (
        <p className="text-sm">
          There is nothing new to import from this file.
        </p>
      )}
      {importable.map((s: McpImportPreviewServer) => (
        <label key={s.name} className="flex items-start gap-2 py-0.5 text-sm">
          <input
            type="checkbox"
            checked={!unchecked.has(s.name)}
            onChange={(e) => {
              const next = new Set(unchecked);
              if (e.target.checked) next.delete(s.name);
              else next.add(s.name);
              setUnchecked(next);
            }}
          />
          <span>
            {s.name} <span className="text-description">({s.transport})</span>
            {s.allowedToolCount > 0 && (
              <span className="text-description">
                {" "}
                , {s.allowedToolCount} auto-approved tool
                {s.allowedToolCount === 1 ? "" : "s"}
              </span>
            )}
          </span>
        </label>
      ))}
      {skipped.length > 0 && (
        <p className="mt-2 text-xs text-description">
          Skipped:{" "}
          {skipped
            .map((s) => `${s.name} (${SKIP_LABELS[s.status] ?? s.status})`)
            .join(", ")}
        </p>
      )}

      {secretNames.length > 0 && (
        <div className="mt-3 text-sm">
          <p className="mb-1">
            Credentials ({secretNames.join(", ")}) are never written to
            config.yaml. It will refer to them as{" "}
            <code>{"${{ secrets.NAME }}"}</code>.
          </p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={storeSecrets}
              onChange={(e) => setStoreSecrets(e.target.checked)}
            />
            Store the credential values now
          </label>
          {storeSecrets && secureAvailable && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useSecure}
                onChange={(e) => setUseSecure(e.target.checked)}
              />
              Use the editor's secure storage (otherwise ~/.continuous/.env)
            </label>
          )}
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button onClick={runImport} disabled={busy || chosen.length === 0}>
          Import {chosen.length || ""}
        </Button>
      </div>
    </div>
  );
}

/**
 * "Import from Cline" action for the MCP section. Shown only when a Cline or
 * Roo Code settings file with servers is found.
 */
export function ImportClineMcpButton() {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();
  const [sources, setSources] = useState<McpImportPreviewSource[]>([]);

  useEffect(() => {
    let cancelled = false;
    void ideMessenger
      .request("config/previewMcpImport", undefined)
      .then((res) => {
        if (!cancelled && res.status === "success") {
          setSources(res.content.sources.filter((s) => s.servers.length > 0));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ideMessenger]);

  if (sources.length === 0) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      data-testid="import-cline-mcp"
      onClick={() => {
        dispatch(setDialogMessage(<ImportDialog sources={sources} />));
        dispatch(setShowDialog(true));
      }}
    >
      Import MCP servers from Cline
    </Button>
  );
}
