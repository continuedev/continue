import type { PlaintextKey } from "core/config/providers/types";
import { useContext, useEffect, useState } from "react";
import { Button, Card } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppSelector } from "../../../redux/hooks";

/**
 * Lists API keys written as plain text in local configs and providers files
 * and offers to move them into secure storage. Values never reach the
 * webview; core reads and stores them.
 */
export function PlaintextKeysNotice() {
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((state) => state.config.config);
  const [keys, setKeys] = useState<PlaintextKey[]>([]);
  const [secureAvailable, setSecureAvailable] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    void ideMessenger
      .request("config/findPlaintextKeys", undefined)
      .then((res) => {
        if (cancelled || res.status !== "success" || !res.content) return;
        setKeys(res.content.keys);
        setSecureAvailable(res.content.secureStorageAvailable);
      })
      .catch(() => {
        // Nothing to show when the check fails.
      });
    return () => {
      cancelled = true;
    };
  }, [ideMessenger, config, reload]);

  if (keys.length === 0 && !message) return null;

  async function move(storage: "secure" | "env") {
    setBusy(true);
    try {
      const res = await ideMessenger.request("config/movePlaintextKeys", {
        ids: keys.map((k) => k.id),
        storage,
      });
      if (res.status !== "success") {
        setMessage("The keys could not be moved.");
        return;
      }
      const { moved, failed } = res.content;
      setMessage(
        failed.length > 0
          ? `${moved.length} moved; ${failed.length} could not be: ${failed[0].error}`
          : `${moved.length} key${moved.length === 1 ? "" : "s"} moved. The configs now refer to them by name.`,
      );
      setReload((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-4" data-testid="plaintext-keys-notice">
      <div className="flex flex-col gap-2 px-3 py-2">
        {keys.length > 0 && (
          <>
            <div className="text-sm font-medium text-warning">
              {keys.length === 1
                ? "An API key is written in plain text"
                : `${keys.length} API keys are written in plain text`}
            </div>
            <ul className="my-0 pl-4 text-xs text-description">
              {keys.map((k) => (
                <li key={k.id}>
                  {k.label} in {k.fileLabel} → <code>{k.secretName}</code>
                </li>
              ))}
            </ul>
            <div className="text-xs text-description-muted">
              Moving stores each key{" "}
              {secureAvailable
                ? "in the editor's secure storage"
                : "in ~/.continue/.env"}{" "}
              and replaces it with a <code>{"${{ secrets.NAME }}"}</code>{" "}
              reference, so the file is safe to share or commit.
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void move(secureAvailable ? "secure" : "env")}
              >
                {secureAvailable
                  ? "Move to secure storage"
                  : "Move to ~/.continue/.env"}
              </Button>
            </div>
          </>
        )}
        {message && (
          <div className="text-xs text-description" role="status">
            {message}
          </div>
        )}
      </div>
    </Card>
  );
}
