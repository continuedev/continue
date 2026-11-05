import type { ModeReasoningEffort } from "core";
import { useContext, useEffect, useMemo, useState } from "react";
import { Button, Card } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppSelector } from "../../../redux/hooks";
import {
  buildUpdate,
  draftFromConfig,
  hasChanges,
  ModeDrafts,
  setEffort,
  TABLE_MODES,
  TableMode,
} from "../../../util/modeModelsDraft";
import { MODE_LABEL, ModeCell } from "./ModeCell";

const EFFORTS: { value: ModeReasoningEffort | ""; label: string }[] = [
  { value: "", label: "Default" },
  { value: "off", label: "Off" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

type Status =
  { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string };

/**
 * Choose which chat models each mode offers (`modeModels.<mode>.models`), a
 * default per mode, and a reasoning effort. Edits stay in a draft until Save,
 * which writes config.yaml with comments kept.
 */
export function ModeModelsTable() {
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((state) => state.config.config);
  const models = config.modelsByRole.chat;

  // What config.yaml says now. The draft resets when it changes underneath us
  // (a save, a reload, or an edit made in the file).
  const loaded = useMemo(() => draftFromConfig(config), [config.modeModels]);
  const [draft, setDraft] = useState<ModeDrafts>(loaded);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  useEffect(() => setDraft(loaded), [loaded]);

  const update = useMemo(() => buildUpdate(loaded, draft), [loaded, draft]);
  const dirty = hasChanges(update);

  if (models.length === 0) return null;

  function edit(mode: TableMode, next: ModeDrafts[TableMode]) {
    setDraft((d) => ({ ...d, [mode]: next }));
  }

  async function save() {
    setStatus({ kind: "saving" });
    try {
      const result = await ideMessenger.request("config/setModeModels", update);
      if (result.status === "success" && result.content.saved) {
        setStatus({ kind: "idle" });
        return;
      }
      setStatus({
        kind: "error",
        message:
          result.status === "success"
            ? "These settings can only be saved to a local YAML config, and the selected config is not one."
            : "Could not save. Check that the config file is not read-only.",
      });
    } catch {
      // A thrown request must not leave the button stuck on "Saving...".
      setStatus({
        kind: "error",
        message: "Could not save. Check that the config file is not read-only.",
      });
    }
  }

  return (
    <Card>
      <div className="mb-3">
        <div className="text-base font-medium">Models per mode</div>
        <p className="mt-1 text-xs text-description">
          Tick the models each mode offers. The star marks the one selected when
          you switch into the mode. Saved to config.yaml.
        </p>
      </div>

      <table className="w-full text-sm" data-testid="mode-models-table">
        <thead>
          <tr className="text-left text-xs text-description">
            <th className="py-1 font-normal">Model</th>
            {TABLE_MODES.map((mode) => (
              <th key={mode} className="px-2 py-1 text-center font-normal">
                {MODE_LABEL[mode]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {models.map((model) => (
            <tr key={model.title} className="border-t border-command-border">
              <td className="py-1.5 pr-2">
                <span className="line-clamp-1">{model.title}</span>
              </td>
              {TABLE_MODES.map((mode) => (
                <td key={mode} className="px-2 py-1.5">
                  <ModeCell
                    mode={mode}
                    title={model.title}
                    draft={draft[mode]}
                    onChange={(next) => edit(mode, next)}
                  />
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-command-border">
            <td className="py-1.5 pr-2 text-xs text-description">
              Reasoning effort
            </td>
            {TABLE_MODES.map((mode) => (
              <td key={mode} className="px-2 py-1.5 text-center">
                <select
                  aria-label={`Reasoning effort for ${MODE_LABEL[mode]}`}
                  value={draft[mode].effort ?? ""}
                  disabled={draft[mode].offered.length === 0}
                  onChange={(e) =>
                    edit(
                      mode,
                      setEffort(
                        draft[mode],
                        (e.target.value || undefined) as
                          ModeReasoningEffort | undefined,
                      ),
                    )
                  }
                  className="rounded-sm border border-command-border bg-input px-1 py-0.5 text-xs"
                >
                  {EFFORTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          disabled={!dirty || status.kind === "saving"}
          onClick={save}
          data-testid="mode-models-save"
        >
          {status.kind === "saving" ? "Saving..." : "Save"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!dirty || status.kind === "saving"}
          onClick={() => {
            setDraft(loaded);
            setStatus({ kind: "idle" });
          }}
        >
          Reset
        </Button>
        {status.kind === "error" && (
          <span className="text-xs text-error" role="alert">
            {status.message}
          </span>
        )}
      </div>
    </Card>
  );
}
