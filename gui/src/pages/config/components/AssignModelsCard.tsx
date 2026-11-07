import {
  ASSIGNABLE_ROLES,
  type AssignableRole,
} from "core/config/yaml/modelRoles";
import type { CatalogListEntry } from "core/config/yaml/saveModelRoles";
import { useContext, useEffect, useMemo, useState } from "react";
import { Button, Card } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useModelCatalog } from "../../../hooks/useModelCatalog";
import { useAppSelector } from "../../../redux/hooks";

const ROLE_LABEL: Record<AssignableRole, string> = {
  chat: "Chat",
  edit: "Edit",
  apply: "Apply",
  autocomplete: "Autocomplete",
  subagent: "Subagents",
  summarize: "Compaction",
};

interface Row {
  ref: string;
  /** Where it is served: the account, or the provider for an inline model. */
  where?: string;
  inCatalog: boolean;
}

type Assigned = Record<string, AssignableRole[]>;

/**
 * Every model, from the catalog (each variant too) and the config, against
 * the roles it can have: tick a box to use a model for that role. Mixing
 * accounts is the point: a local model for Chat, Claude on Bedrock for
 * Subagents. Saved to the selected config: a catalog model gets a `from:`
 * entry with its roles, and loses it again when no role is left.
 */
export function AssignModelsCard() {
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((state) => state.config.config);
  const catalog = useModelCatalog();

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = catalog.map((c: CatalogListEntry) => ({
      ref: c.ref,
      where: c.account ?? c.provider,
      inCatalog: true,
    }));
    const seen = new Set(out.map((r) => r.ref));
    for (const role of ASSIGNABLE_ROLES) {
      for (const m of config.modelsByRole[role] ?? []) {
        if (seen.has(m.title)) continue;
        seen.add(m.title);
        out.push({ ref: m.title, where: m.provider, inCatalog: false });
      }
    }
    return out;
  }, [catalog, config.modelsByRole]);

  const loaded = useMemo<Assigned>(() => {
    const out: Assigned = {};
    for (const row of rows) {
      out[row.ref] = ASSIGNABLE_ROLES.filter((role) =>
        (config.modelsByRole[role] ?? []).some((m) => m.title === row.ref),
      );
    }
    return out;
  }, [rows, config.modelsByRole]);

  const [draft, setDraft] = useState<Assigned>(loaded);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(loaded), [loaded]);

  const changed = rows.filter(
    (r) =>
      (draft[r.ref] ?? []).slice().sort().join() !==
      (loaded[r.ref] ?? []).slice().sort().join(),
  );

  if (catalog.length === 0) return null; // the role pickers above cover config-only setups

  function toggle(ref: string, role: AssignableRole, on: boolean) {
    setDraft((d) => {
      const current = d[ref] ?? [];
      const next = on
        ? [...current.filter((r) => r !== role), role]
        : current.filter((r) => r !== role);
      return { ...d, [ref]: next };
    });
  }

  async function save() {
    setSaving(true);
    setError(undefined);
    try {
      const res = await ideMessenger.request("config/setModelRoles", {
        updates: changed.map((r) => ({
          ref: r.ref,
          roles: draft[r.ref] ?? [],
        })),
      });
      if (res.status !== "success" || !res.content.saved) {
        setError(
          "Roles can only be saved to a local YAML config, and the selected config is not one.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="mb-3">
        <div className="text-base font-medium">Assign models</div>
        <p className="mt-1 text-xs text-description">
          Every model in the catalog (models.yaml) and the config, from every
          account. Tick what each one is used for; models from different
          accounts mix freely.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="assign-models-table">
          <thead>
            <tr className="text-left text-xs text-description">
              <th className="py-1 font-normal">Model</th>
              {ASSIGNABLE_ROLES.map((role) => (
                <th key={role} className="px-1 py-1 text-center font-normal">
                  {ROLE_LABEL[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.ref} className="border-t border-command-border">
                <td className="py-1.5 pr-2">
                  <span className="line-clamp-1">{row.ref}</span>
                  {row.where && (
                    <span className="block text-2xs text-description-muted">
                      {row.where}
                      {row.inCatalog ? "" : " (in this config only)"}
                    </span>
                  )}
                </td>
                {ASSIGNABLE_ROLES.map((role) => (
                  <td key={role} className="px-1 py-1.5 text-center">
                    <input
                      type="checkbox"
                      aria-label={`${ROLE_LABEL[role]}: ${row.ref}`}
                      checked={(draft[row.ref] ?? []).includes(role)}
                      onChange={(e) => toggle(row.ref, role, e.target.checked)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <div className="mt-2 text-xs text-error">{error}</div>}
      <div className="mt-2 flex justify-end">
        <Button
          size="sm"
          disabled={changed.length === 0 || saving}
          onClick={save}
          data-testid="assign-models-save"
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </Card>
  );
}
