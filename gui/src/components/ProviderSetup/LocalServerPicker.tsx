import { ArrowPathIcon } from "@heroicons/react/24/outline";
import {
  DetectedLocalServer,
  LOCAL_SERVER_PRESETS,
} from "core/llm/localServers";
import { useContext, useState } from "react";
import { Button } from "../ui";
import { IdeMessengerContext } from "../../context/IdeMessenger";

interface LocalServerPickerProps {
  /** The address in the form now, to mark the matching choice. */
  apiBase?: string;
  /** Use this address; `server` is set when it came from detection. */
  onPick: (apiBase: string, server?: DetectedLocalServer) => void;
}

const sameBase = (a?: string, b?: string) =>
  !!a && !!b && a.replace(/\/+$/, "") === b.replace(/\/+$/, "");

function summary(server: DetectedLocalServer): string {
  if (server.needsKey) return "needs an API key";
  if (server.models.length === 0) return "no model loaded";
  const [first, ...rest] = server.models;
  return rest.length > 0 ? `${first.name} and ${rest.length} more` : first.name;
}

/**
 * The usual local server addresses, and a search for servers that are
 * running now, for the "Local server (OpenAI-compatible)" provider.
 */
export function LocalServerPicker({ apiBase, onPick }: LocalServerPickerProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const [detecting, setDetecting] = useState(false);
  const [found, setFound] = useState<DetectedLocalServer[]>();
  const [error, setError] = useState<string>();

  async function detect() {
    setDetecting(true);
    setError(undefined);
    try {
      const res = await ideMessenger.request("models/detectLocal", undefined);
      if (res.status !== "success") {
        setError(res.error ?? "Could not look for servers");
        return;
      }
      setFound(res.content);
      const ready = res.content.filter((s) => s.models.length > 0);
      // One server with models: use it straight away.
      if (ready.length === 1) onPick(ready[0].apiBase, ready[0]);
    } finally {
      setDetecting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2" data-testid="local-server-picker">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Server</span>
        <Button
          variant="outline"
          size="sm"
          onClick={detect}
          disabled={detecting}
          className="flex items-center gap-1"
        >
          <ArrowPathIcon
            className={`h-3 w-3 ${detecting ? "animate-spin" : ""}`}
          />
          Detect
        </Button>
      </div>

      {found && found.length === 0 && (
        <span className="text-xs text-warning">
          No server answered on the usual ports. Start one, or enter its address
          below.
        </span>
      )}
      {found && found.length > 0 && (
        <div
          className="flex flex-col gap-1"
          role="list"
          aria-label="Found servers"
        >
          {found.map((server) => (
            <button
              key={server.apiBase}
              type="button"
              role="listitem"
              onClick={() => onPick(server.apiBase, server)}
              className={`flex cursor-pointer items-center justify-between rounded-sm border border-solid px-2 py-1 text-left text-xs ${
                sameBase(apiBase, server.apiBase)
                  ? "border-primary bg-input"
                  : "border-description bg-transparent hover:bg-input"
              } text-foreground`}
            >
              <span>
                <span className="font-medium">{server.title}</span>{" "}
                <span className="text-description-muted">{server.apiBase}</span>
              </span>
              <span className="text-description-muted">{summary(server)}</span>
            </button>
          ))}
        </div>
      )}
      {error && <span className="text-xs text-error">{error}</span>}

      <div className="flex flex-wrap gap-1" aria-label="Usual addresses">
        {LOCAL_SERVER_PRESETS.slice(0, 4).map((preset) => (
          <button
            key={preset.apiBase}
            type="button"
            title={preset.apiBase}
            onClick={() => onPick(preset.apiBase)}
            className={`cursor-pointer rounded-full border border-solid px-2 py-0.5 text-2xs text-foreground ${
              sameBase(apiBase, preset.apiBase)
                ? "border-primary bg-input"
                : "border-description bg-transparent hover:bg-input"
            }`}
          >
            {preset.title} ({new URL(preset.apiBase).port})
          </button>
        ))}
      </div>
    </div>
  );
}
