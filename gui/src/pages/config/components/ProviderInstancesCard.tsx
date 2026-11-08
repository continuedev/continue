import type {
  ProviderInstanceInfo,
  ProviderInstancesInfo,
  SaveProviderInstanceRequest,
} from "core/config/providers/types";
import { defaultSecretName } from "core/config/providerSecretName";
import { useContext, useEffect, useMemo, useState } from "react";
import { Input } from "../../../components";
import { Button, Card, Divider } from "../../../components/ui";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { FormSelect } from "../../../forms/FormSelect";
import { useAppSelector } from "../../../redux/hooks";
import { providers as knownProviders } from "../../AddNewModel/configs/providers";

const ROLES = ["chat", "edit", "apply", "autocomplete", "embed", "rerank"];

function keyLabel(i: ProviderInstanceInfo): string {
  switch (i.key.state) {
    case "none":
      return "no key";
    case "inline":
      return "key in plain text";
    case "secret": {
      const where = i.key.storedIn;
      if (where?.secure) return "key in secure storage";
      if (where?.env) return "key in ~/.continuous/.env";
      return `key ${i.key.secretName} not set`;
    }
  }
}

type FormState = {
  previousName?: string;
  name: string;
  provider: string;
  apiBase: string;
  key: string;
  storage: "secure" | "env" | "none" | "keep";
};

function emptyForm(storage: "secure" | "env"): FormState {
  return { name: "", provider: "", apiBase: "", key: "", storage };
}

/**
 * Named provider instances from providers.yaml: one per account or endpoint,
 * with its key kept out of the configs. Models in any config use one with
 * `connection: <name>`.
 */
export function ProviderInstancesCard() {
  const ideMessenger = useContext(IdeMessengerContext);
  const config = useAppSelector((state) => state.config.config);
  const [info, setInfo] = useState<ProviderInstancesInfo>();
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState<FormState>();
  const [addingModelTo, setAddingModelTo] = useState<string>();
  const [modelId, setModelId] = useState("");
  const [modelRoles, setModelRoles] = useState<string[]>(["chat"]);
  const [confirmDelete, setConfirmDelete] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ideMessenger
      .request("providers/list", undefined)
      .then((res) => {
        if (!cancelled && res.status === "success") setInfo(res.content);
      })
      .catch(() => {
        // Older cores do not know the message; the card stays empty.
      });
    return () => {
      cancelled = true;
    };
  }, [ideMessenger, config, reload]);

  const providerOptions = useMemo(
    () =>
      Object.values(knownProviders)
        .flatMap((p) => (p ? [{ value: p.provider, label: p.title }] : []))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [],
  );
  const defaultStorage = info?.secureStorageAvailable ? "secure" : "env";

  function startEdit(i: ProviderInstanceInfo) {
    setError(undefined);
    setForm({
      previousName: i.name,
      name: i.name,
      provider: i.provider,
      apiBase: i.apiBase ?? "",
      key: "",
      storage: i.key.state === "none" ? "none" : "keep",
    });
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    setError(undefined);
    try {
      const req: SaveProviderInstanceRequest = {
        ...(form.previousName ? { previousName: form.previousName } : {}),
        name: form.name.trim(),
        provider: form.provider,
        ...(form.apiBase.trim() ? { apiBase: form.apiBase.trim() } : {}),
      };
      if (form.storage === "none") {
        req.key = { storage: "none" };
      } else if (form.storage !== "keep" || form.key) {
        const storage = form.storage === "keep" ? defaultStorage : form.storage;
        req.key = {
          storage,
          ...(form.key ? { value: form.key } : {}),
        };
      }
      const res = await ideMessenger.request("providers/save", req);
      const content = res.status === "success" ? res.content : undefined;
      if (!content?.saved) {
        setError(content && !content.saved ? content.error : "Could not save");
        return;
      }
      setNotice(
        content.modelsUpdated
          ? `Saved. ${content.modelsUpdated} model(s) now use the new name.`
          : "Saved.",
      );
      setForm(undefined);
      setReload((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  async function remove(name: string) {
    setBusy(true);
    try {
      const res = await ideMessenger.request("providers/delete", { name });
      const content = res.status === "success" ? res.content : undefined;
      if (!content?.deleted) setError(content?.error ?? "Could not delete");
      setConfirmDelete(undefined);
      setReload((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  async function addModel(connection: string) {
    setBusy(true);
    setError(undefined);
    try {
      const res = await ideMessenger.request("config/addConnectedModel", {
        connection,
        model: modelId.trim(),
        roles: modelRoles,
      });
      const content = res.status === "success" ? res.content : undefined;
      if (!content?.saved) {
        setError(content?.error ?? "Could not add the model");
        return;
      }
      setNotice(`Added ${modelId.trim()} to the selected config.`);
      setAddingModelTo(undefined);
      setModelId("");
    } finally {
      setBusy(false);
    }
  }

  const instances = info?.instances ?? [];

  return (
    <Card>
      <div className="flex items-center justify-between px-3 py-2">
        <div>
          <div className="text-sm font-medium">Provider accounts</div>
          <div className="text-xs text-description-muted">
            Named connections in providers.yaml, shared by every config. Keys
            stay in secure storage.
          </div>
        </div>
        <div className="flex gap-1">
          {info && (
            <Button
              variant="ghost"
              size="sm"
              className="my-0"
              onClick={() =>
                ideMessenger.post("openFile", { path: info.globalFileUri })
              }
            >
              Edit YAML
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            className="my-0"
            data-testid="add-provider-instance"
            onClick={() => {
              setError(undefined);
              setForm(emptyForm(defaultStorage));
            }}
          >
            Add
          </Button>
        </div>
      </div>

      {notice && (
        <div className="px-3 pb-2 text-xs text-success" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="px-3 pb-2 text-xs text-error" role="alert">
          {error}
        </div>
      )}

      {form && (
        <div
          className="flex flex-col gap-2 px-3 pb-3"
          data-testid="provider-instance-form"
        >
          <label className="text-xs font-medium" htmlFor="instance-name">
            Name
          </label>
          <Input
            id="instance-name"
            value={form.name}
            placeholder="e.g. anthropic-work"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <label className="text-xs font-medium" htmlFor="instance-provider">
            Provider
          </label>
          <FormSelect
            id="instance-provider"
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value })}
          >
            <option value="">Choose a provider</option>
            {providerOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            {form.provider &&
              !providerOptions.some((o) => o.value === form.provider) && (
                <option value={form.provider}>{form.provider}</option>
              )}
          </FormSelect>
          <label className="text-xs font-medium" htmlFor="instance-api-base">
            Base URL (optional)
          </label>
          <Input
            id="instance-api-base"
            value={form.apiBase}
            placeholder="Leave blank for the provider's default"
            onChange={(e) => setForm({ ...form, apiBase: e.target.value })}
          />
          <label className="text-xs font-medium" htmlFor="instance-key-storage">
            API key
          </label>
          <FormSelect
            id="instance-key-storage"
            value={form.storage}
            onChange={(e) =>
              setForm({
                ...form,
                storage: e.target.value as FormState["storage"],
              })
            }
          >
            {form.previousName && (
              <option value="keep">Keep the current key</option>
            )}
            {info?.secureStorageAvailable && (
              <option value="secure">Editor's secure storage</option>
            )}
            <option value="env">~/.continuous/.env</option>
            <option value="none">No key (e.g. a local server)</option>
          </FormSelect>
          {form.storage !== "none" && (
            <>
              <Input
                id="instance-key"
                type="password"
                autoComplete="off"
                aria-label="API key value"
                value={form.key}
                placeholder={
                  form.storage === "keep"
                    ? "Leave blank to keep the current key"
                    : "Paste the API key"
                }
                onChange={(e) => setForm({ ...form, key: e.target.value })}
              />
              <span className="text-xs text-description-muted">
                Saved as{" "}
                <code>{`\${{ secrets.${defaultSecretName(form.name || "NAME")} }}`}</code>
                ; the key itself never goes into providers.yaml.
              </span>
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setForm(undefined)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={busy || !form.name.trim() || !form.provider}
              onClick={() => void save()}
            >
              Save
            </Button>
          </div>
        </div>
      )}

      {instances.length === 0 && !form && (
        <div className="px-3 pb-3 text-xs text-description-muted">
          No provider accounts yet. Add one to share a key and base URL between
          configs.
        </div>
      )}

      {instances.map((i, index) => (
        <div key={`${i.source}:${i.name}`} data-testid="provider-instance">
          <Divider />
          <div className="flex items-start justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm">
                {i.name}{" "}
                <span className="text-xs text-description-muted">
                  {i.provider}
                  {i.source === "workspace" ? " · workspace" : ""}
                  {i.overridden ? " · replaced by the workspace's" : ""}
                </span>
              </div>
              <div className="truncate text-xs text-description-muted">
                {[
                  i.apiBase,
                  keyLabel(i),
                  i.usedBy.length > 0
                    ? `${i.usedBy.length} model${i.usedBy.length === 1 ? "" : "s"}`
                    : "not used yet",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="my-0"
                onClick={() => {
                  setAddingModelTo(
                    addingModelTo === i.name ? undefined : i.name,
                  );
                  setModelId("");
                }}
              >
                Add model
              </Button>
              {i.source === "global" ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="my-0"
                    onClick={() => startEdit(i)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="my-0"
                    onClick={() => setConfirmDelete(i.name)}
                  >
                    Delete
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="my-0"
                  onClick={() =>
                    ideMessenger.post("openFile", { path: i.sourceUri })
                  }
                >
                  Open
                </Button>
              )}
            </div>
          </div>

          {confirmDelete === i.name && (
            <div className="flex items-center justify-between gap-2 px-3 pb-2 text-xs">
              <span>
                Delete {i.name}?
                {i.usedBy.length > 0 &&
                  ` ${i.usedBy.length} model(s) use it and will be skipped until it is added again.`}{" "}
                The key stays where it is.
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(undefined)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void remove(i.name)}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}

          {addingModelTo === i.name && (
            <div className="flex flex-col gap-2 px-3 pb-3">
              <Input
                aria-label="Model id"
                value={modelId}
                placeholder="Model id, e.g. claude-sonnet-4-6"
                onChange={(e) => setModelId(e.target.value)}
              />
              <div className="flex flex-wrap gap-2 text-xs">
                {ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={modelRoles.includes(role)}
                      onChange={(e) =>
                        setModelRoles(
                          e.target.checked
                            ? [...modelRoles, role]
                            : modelRoles.filter((r) => r !== role),
                        )
                      }
                    />
                    {role}
                  </label>
                ))}
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={busy || !modelId.trim()}
                  onClick={() => void addModel(i.name)}
                >
                  Add to the selected config
                </Button>
              </div>
            </div>
          )}
          {index === instances.length - 1 && <div className="pb-1" />}
        </div>
      ))}
    </Card>
  );
}
