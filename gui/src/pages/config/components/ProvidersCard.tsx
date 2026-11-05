import type {
  ProviderSetupConnection,
  ProviderSetupInfo,
} from "core/config/providerSetup";
import { useContext, useEffect, useState } from "react";
import { useProviderSetupDialog } from "../../../components/ProviderSetup/useProviderSetupDialog";
import { Button, Card } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppSelector } from "../../../redux/hooks";
import { providerLabel } from "../../../util/missingSecrets";

function describe(c: ProviderSetupConnection): string {
  const where =
    c.connection.apiBase ?? c.connection.region ?? c.connection.profile;
  const count = `${c.models.length} model${c.models.length === 1 ? "" : "s"}`;
  return where ? `${where} - ${count}` : count;
}

type KeyAction = { kind: "move" | "removeCopy"; secretName: string };

/** What can be done about where this connection's key is kept, if anything. */
function keyActionFor(
  c: ProviderSetupConnection,
  secureStorageAvailable: boolean,
): KeyAction | undefined {
  const { secretName, storedIn } = c.key;
  if (c.key.state !== "secret" || !secretName || !storedIn?.env) {
    return undefined;
  }
  if (!storedIn.secure) {
    return secureStorageAvailable ? { kind: "move", secretName } : undefined;
  }
  return { kind: "removeCopy", secretName };
}

/**
 * One row per provider connection in config.yaml, with a way back into the
 * setup flow to change its models or key.
 */
export function ProvidersCard() {
  const ideMessenger = useContext(IdeMessengerContext);
  const { openSetup } = useProviderSetupDialog();
  // The config object changes whenever a save reloads it.
  const config = useAppSelector((state) => state.config.config);
  const [info, setInfo] = useState<ProviderSetupInfo>();
  const [reload, setReload] = useState(0);
  // The key action being confirmed, and the last failure. Never a key value.
  const [confirming, setConfirming] = useState<KeyAction>();
  const [busy, setBusy] = useState(false);
  const [keyError, setKeyError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    void ideMessenger
      .request("config/getProviderSetup", undefined)
      .then((res) => {
        if (!cancelled && res.status === "success") setInfo(res.content);
      });
    return () => {
      cancelled = true;
    };
  }, [ideMessenger, config, reload]);

  async function runKeyAction(action: KeyAction) {
    setBusy(true);
    setKeyError(undefined);
    try {
      let ok = false;
      let error: string | undefined;
      if (action.kind === "move") {
        const res = await ideMessenger.request(
          "config/moveKeyToSecureStorage",
          { secretName: action.secretName },
        );
        const content = res.status === "success" ? res.content : undefined;
        ok = !!content?.moved;
        error = content?.error;
      } else {
        const res = await ideMessenger.request("config/removeEnvSecret", {
          secretName: action.secretName,
        });
        const content = res.status === "success" ? res.content : undefined;
        ok = !!content?.removed;
        error = content?.error;
      }
      if (error || !ok) {
        setKeyError(error ?? "Could not update where the key is kept");
      }
      setConfirming(undefined);
      setReload((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between px-3 py-2">
        <div>
          <div className="text-sm font-medium">Providers</div>
          <div className="text-xs text-description-muted">
            Connect a provider and choose which of its models to use
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="my-0"
          onClick={() => openSetup()}
          data-testid="add-provider"
        >
          Add provider
        </Button>
      </div>
      {info && info.editable === false && (
        <div className="px-3 pb-2 text-xs text-description-muted">
          Models can only be saved to a local YAML config, and the selected
          config is not one.
        </div>
      )}
      {info?.connections.map((c) => {
        const id = `${c.provider}|${JSON.stringify(c.connection)}`;
        const action = keyActionFor(c, info.secureStorageAvailable);
        const isConfirming =
          !!action &&
          confirming?.kind === action.kind &&
          confirming.secretName === action.secretName;
        return (
          <div
            key={id}
            className="flex flex-col gap-1 px-3 py-1.5 text-xs"
            data-testid={`provider-row-${c.provider}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-medium">{providerLabel(c.provider)}</span>{" "}
                <span className="truncate text-description-muted">
                  {describe(c)}
                </span>
              </div>
              <div className="flex shrink-0 gap-1">
                {action && !isConfirming && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="my-0"
                    onClick={() => setConfirming(action)}
                  >
                    {action.kind === "move"
                      ? "Move key to secure storage"
                      : "Remove .env copy"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="my-0"
                  onClick={() =>
                    openSetup({
                      initialProvider: c.provider,
                      initialConnection: c.connection,
                    })
                  }
                >
                  Edit
                </Button>
              </div>
            </div>
            {action && isConfirming && (
              <div
                className="flex items-center justify-between gap-2"
                data-testid="key-action-confirm"
              >
                <span className="text-description-muted">
                  {action.kind === "move"
                    ? `Move ${action.secretName} from ~/.continue/.env to secure storage and delete it from .env? config.yaml stays the same.`
                    : `${action.secretName} is already in secure storage. Delete the plaintext line from ~/.continue/.env?`}
                </span>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="my-0"
                    onClick={() => setConfirming(undefined)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="my-0"
                    disabled={busy}
                    onClick={() => runKeyAction(action)}
                  >
                    {action.kind === "move" ? "Move" : "Delete line"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {keyError && (
        <div className="px-3 pb-2 text-xs text-error" role="alert">
          {keyError}
        </div>
      )}
    </Card>
  );
}
