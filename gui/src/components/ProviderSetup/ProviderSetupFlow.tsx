import { ArrowPathIcon } from "@heroicons/react/24/outline";
import type {
  KeyStorage,
  ProviderConnectionKey,
  ProviderSetupInfo,
} from "core/config/providerSetup";
import { defaultSecretName } from "core/config/providerSecretName";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Input } from "..";
import { Button } from "../ui";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import {
  areRequiredFieldsFilled,
  buildModelFromForm,
  getBedrockConnectionParams,
  getRenderableFields,
} from "../../forms/addModelFormUtils";
import { listBedrockModelsFor } from "../../forms/bedrockModels";
import { BedrockConnectionTester } from "../../forms/BedrockConnectionTester";
import { FormSelect } from "../../forms/FormSelect";
import {
  BedrockEndpointModel,
  bedrockOptionsToPackages,
  computeModelLists,
} from "../../forms/modelListUtils";
import {
  fetchedToPackages,
  fetchProviderModels,
  initializeDynamicModels,
} from "../../pages/AddNewModel/configs/fetchProviderModels";
import {
  DisplayInfo,
  ModelPackage,
} from "../../pages/AddNewModel/configs/models";
import {
  ProviderInfo,
  providers,
} from "../../pages/AddNewModel/configs/providers";
import ModelSelectionListbox from "../modelSelection/ModelSelectionListbox";
import { LocalServerPicker } from "./LocalServerPicker";
import { ModelChecklist } from "./ModelChecklist";
import {
  buildChecklistRows,
  buildSaveRequest,
  connectionFromModel,
  describeConnection,
  describeKeyPlan,
  diffSelection,
  findConnection,
  initialChecked,
  isOpenAICloud,
  KeyChoice,
  keyProblem,
  keyStorageOptions,
  sameConnection,
  SetupStep,
} from "./providerSetupUtils";
import { ReviewStep } from "./ReviewStep";

export interface ProviderSetupFlowProps {
  /** Provider id to start with (for example "anthropic"). */
  initialProvider?: string;
  /** Edit this configured connection instead of starting a new one. */
  initialConnection?: ProviderConnectionKey;
  /**
   * Only ask for the key of this secret and store it; config.yaml is not
   * changed (the reference in it is already correct).
   */
  enterKey?: { secretName: string };
  onDone: () => void;
  onCancel?: () => void;
}

const POPULAR_PROVIDERS = [
  "openai-compatible",
  "openai",
  "anthropic",
  "mistral",
  "gemini",
  "azure",
  "ollama",
  "openrouter",
];

const isBedrockProvider = (provider: string) =>
  provider === "bedrock" || provider === "bedrock-mantle";

/**
 * The secret name slug: a local server's key is not the OpenAI key, though
 * both use the "openai" provider.
 */
const secretSlug = (p: ProviderInfo) => (p.localServer ? "local" : p.provider);

/**
 * The entry to start with. A configured "openai" connection to any other
 * server than OpenAI's opens as a local server.
 */
function startingProvider(
  initialProvider?: string,
  initialConnection?: ProviderConnectionKey,
): ProviderInfo {
  if (
    initialProvider === "openai" &&
    initialConnection?.apiBase &&
    !isOpenAICloud(initialConnection.apiBase)
  ) {
    return providers["openai-compatible"]!;
  }
  return (
    (initialProvider && providers[initialProvider]) || providers["anthropic"]!
  );
}

function providerLists() {
  const all = Object.values(providers).filter((p): p is ProviderInfo => !!p);
  const byTitle = (a: ProviderInfo, b: ProviderInfo) =>
    a.title.localeCompare(b.title);
  const popularTitles = POPULAR_PROVIDERS.map((id) => providers[id]?.title);
  return {
    popular: all.filter((p) => popularTitles.includes(p.title)).sort(byTitle),
    other: all.filter((p) => !popularTitles.includes(p.title)).sort(byTitle),
  };
}

/**
 * One flow to connect a provider and choose its models: credentials, a model
 * checklist, then a review. Used by the onboarding card, "Manage models" and
 * "Enter key". Nothing is written until the review step is confirmed.
 */
export function ProviderSetupFlow({
  initialProvider,
  initialConnection,
  enterKey,
  onDone,
  onCancel,
}: ProviderSetupFlowProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const lists = useMemo(providerLists, []);

  const [provider, setProvider] = useState<ProviderInfo>(() =>
    startingProvider(initialProvider, initialConnection),
  );
  const [step, setStep] = useState<SetupStep>("credentials");
  const [setup, setSetup] = useState<ProviderSetupInfo>();
  const formMethods = useForm();
  const values = formMethods.watch();

  const [storage, setStorage] = useState<KeyStorage>("env");
  const [secretName, setSecretName] = useState(
    enterKey?.secretName ?? defaultSecretName(secretSlug(provider)),
  );
  const [keyTouched, setKeyTouched] = useState(false);

  const [liveModels, setLiveModels] = useState<ModelPackage[]>([]);
  const [refreshError, setRefreshError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const providerRef = useRef(provider.provider);
  providerRef.current = provider.provider;

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmedRemoval, setConfirmedRemoval] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [warning, setWarning] = useState<string>();
  // Set when the key went to secure storage and ~/.continue/.env still has a
  // plaintext copy: the user is asked before anything is removed.
  const [envCopy, setEnvCopy] = useState<string>();
  const [removingEnvCopy, setRemovingEnvCopy] = useState(false);

  // What is configured today, and where keys can be kept.
  useEffect(() => {
    void initializeDynamicModels(ideMessenger);
    let cancelled = false;
    void ideMessenger
      .request("config/getProviderSetup", undefined)
      .then((res) => {
        if (cancelled || res.status !== "success") return;
        setSetup(res.content);
        setStorage(res.content.preferredKeyStorage);
      })
      .catch(() => {
        // The setup info only refines defaults; the flow works without it.
      });
    return () => {
      cancelled = true;
    };
  }, [ideMessenger]);

  // Prefill the connection fields when editing.
  useEffect(() => {
    if (!initialConnection) return;
    for (const [key, value] of Object.entries(initialConnection)) {
      formMethods.setValue(key, value);
    }
  }, [initialConnection]);

  // New provider: new default name, no leftover list.
  useEffect(() => {
    setLiveModels([]);
    setRefreshError(undefined);
    if (!enterKey) {
      setSecretName(defaultSecretName(secretSlug(provider)));
      setKeyTouched(false);
    }
  }, [provider]);

  const isBedrock = isBedrockProvider(provider.provider);
  const isLocal = !!provider.localServer;
  // A local server's key is optional: only one started with a key needs it.
  const hasKeyField = !!provider.apiKeyUrl || isLocal;

  // The connection the form describes, as core will match it.
  const connection = useMemo(
    () =>
      connectionFromModel(
        buildModelFromForm(provider, provider.packages[0], values),
      ),
    [provider, values],
  );
  // When editing, the connection in config.yaml is the one the form started
  // from, even after its endpoint field is changed: that edit moves it.
  const editing = !enterKey ? initialConnection : undefined;
  const connectionMoved = !!editing && !sameConnection(editing, connection);
  const configured = findConnection(
    setup?.connections ?? [],
    provider.provider,
    editing ?? connection,
  );
  const configuredModels = configured?.models ?? [];
  // A new connection is saved as a provider account with catalog models;
  // one already set up the old way (models with their own connection) is
  // edited as it is. A server found by Detect suggests the account's name.
  const [detectedName, setDetectedName] = useState<string>();
  const accountForSave = configured?.account
    ? { name: configured.account }
    : configured
      ? undefined
      : { name: isLocal ? detectedName : undefined };
  const hasStoredKey = (configured?.key.state ?? "none") !== "none";

  // Reuse the secret name the connection already refers to.
  useEffect(() => {
    if (!enterKey && configured?.key.secretName && !keyTouched) {
      setSecretName(configured.key.secretName);
    }
  }, [configured?.key.secretName]);

  const modelLists = computeModelLists(provider, liveModels);
  const groups = useMemo(
    () => buildChecklistRows(modelLists, configuredModels),
    [modelLists.top, modelLists.other, configuredModels],
  );

  // Start from what is configured (or the popular models) when the target
  // connection changes.
  const connectionId = `${provider.provider}|${JSON.stringify(editing ?? connection)}|${!!setup}`;
  // Until a box is changed by hand, the selection follows the list: the
  // provider's own model list replaces the presets when it arrives, and
  // presets the server does not have must not stay selected (and be saved).
  const selectionTouched = useRef(false);
  useEffect(() => {
    selectionTouched.current = false;
    setChecked(initialChecked(groups, configuredModels));
    setConfirmedRemoval(false);
  }, [connectionId]);
  const listKey = JSON.stringify(
    [groups.configuredOnly, groups.top, groups.other].map((rows) =>
      rows.map((r) => r.model),
    ),
  );
  useEffect(() => {
    if (!selectionTouched.current) {
      setChecked(initialChecked(groups, configuredModels));
    }
  }, [listKey]);

  const keyChoice: KeyChoice = {
    storage,
    secretName,
    value: formMethods.watch("apiKey") ?? "",
  };
  const keyRequired = enterKey
    ? true
    : hasKeyField && !isLocal && !hasStoredKey;
  const keyIssue = hasKeyField
    ? keyProblem(keyChoice, { keyRequired })
    : undefined;
  // A key that is already set up satisfies the provider's required key field.
  const fieldsFilled = areRequiredFieldsFilled(
    provider,
    hasStoredKey && !values.apiKey ? { ...values, apiKey: "stored" } : values,
  );
  const canContinue = enterKey
    ? !keyIssue && keyChoice.value !== ""
    : fieldsFilled && !keyIssue;

  // The key section is sent only when there is something to say about it.
  const sendKey =
    hasKeyField && (keyChoice.value !== "" || storage === "envVar");
  const keyForRequest = sendKey ? keyChoice : undefined;

  const diff = diffSelection(groups, configuredModels, checked);
  const hasChanges =
    diff.add.length > 0 || diff.remove.length > 0 || sendKey || connectionMoved;
  const needsConfirm = diff.remove.length > 0 && !confirmedRemoval;

  const canRefresh =
    isBedrock || isLocal
      ? fieldsFilled
      : !!keyChoice.value &&
        provider.provider !== "ollama" &&
        provider.provider !== "openrouter";

  async function refreshModels() {
    const forProvider = provider.provider;
    setRefreshing(true);
    setRefreshError(undefined);
    try {
      if (isBedrockProvider(forProvider)) {
        const result = await listBedrockModelsFor(
          ideMessenger,
          getBedrockConnectionParams(provider, provider.packages[0], values),
        );
        if (!result.ok) return setRefreshError(result.error);
        applyBedrock(result.models);
        return;
      }
      const fetched = await fetchProviderModels(
        ideMessenger,
        forProvider,
        formMethods.getValues("apiKey"),
        // The form's value, or the field's default when it was not edited.
        isLocal ? connection.apiBase : formMethods.getValues("apiBase"),
      );
      if (fetched.length === 0) {
        setRefreshError(
          isLocal
            ? "The server listed no models. Check that a model is loaded."
            : "No models were returned. Check the API key.",
        );
        return;
      }
      if (providerRef.current === forProvider) {
        setLiveModels(fetched);
        // A server that names itself names the account, as Detect does
        const server = fetched.find((p) => p.server)?.server;
        if (isLocal && server) setDetectedName((d) => d ?? server);
      }
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }

  /** Each Bedrock entry lists its own endpoint's models only. */
  function applyBedrock(models: BedrockEndpointModel[]) {
    const endpoint =
      provider.provider === "bedrock-mantle" ? "mantle" : "runtime";
    setLiveModels(
      bedrockOptionsToPackages(
        models.filter((m) => m.endpoint === endpoint),
        provider.provider as "bedrock" | "bedrock-mantle",
      ),
    );
  }

  function toggle(model: string) {
    selectionTouched.current = true;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(model)) next.delete(model);
      else next.add(model);
      return next;
    });
    setConfirmedRemoval(false);
  }

  async function saveKeyOnly() {
    setSaving(true);
    setError(undefined);
    try {
      const res = await ideMessenger.request("config/setSecret", {
        secretName,
        value: keyChoice.value,
        storage: storage === "secure" ? "secure" : "env",
      });
      if (res.status !== "success" || !res.content.stored) {
        setError(
          (res.status === "success" ? res.content.error : undefined) ??
            "Could not save the key",
        );
        return;
      }
      formMethods.setValue("apiKey", "");
      if (res.content.warning) setWarning(res.content.warning);
      if (res.content.envShadowed) setEnvCopy(secretName);
      else onDone();
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(undefined);
    try {
      const request = buildSaveRequest({
        provider,
        editing,
        values,
        diff,
        key: keyForRequest,
        useLiveTitles: isBedrock && modelLists.isLive,
        account: accountForSave,
      });
      const res = await ideMessenger.request(
        "config/saveProviderModels",
        request,
      );
      if (res.status !== "success" || !res.content.saved) {
        setError(
          (res.status === "success" ? res.content.error : undefined) ??
            "Could not save",
        );
        return;
      }
      formMethods.setValue("apiKey", "");
      if (res.content.warning) setWarning(res.content.warning);
      if (res.content.envShadowedSecret) {
        setEnvCopy(res.content.envShadowedSecret);
      } else {
        onDone();
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeEnvCopy() {
    if (!envCopy) return;
    setRemovingEnvCopy(true);
    setError(undefined);
    try {
      const res = await ideMessenger.request("config/removeEnvSecret", {
        secretName: envCopy,
      });
      if (res.status !== "success" || !res.content.removed) {
        setError(
          (res.status === "success" ? res.content.error : undefined) ??
            "Could not remove the line from ~/.continue/.env",
        );
        return;
      }
      onDone();
    } finally {
      setRemovingEnvCopy(false);
    }
  }

  const storageOptions = keyStorageOptions(
    setup?.secureStorageAvailable ?? false,
  );
  const storageChoices = enterKey
    ? storageOptions.filter((o) => o.value === "secure" || o.value === "env")
    : storageOptions;

  const keySection = hasKeyField && (
    <div className="flex flex-col gap-2">
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="apiKey">
          API key
        </label>
        <Input
          id="apiKey"
          className="w-full"
          type="password"
          autoComplete="off"
          placeholder={
            hasStoredKey && !enterKey
              ? "saved - leave blank to keep"
              : isLocal
                ? "Optional: only if the server was started with a key"
                : `Enter your ${provider.title} API key`
          }
          {...formMethods.register("apiKey")}
        />
        {provider.apiKeyUrl && (
          <span className="mt-1 block text-xs text-description-muted">
            <a
              className="cursor-pointer text-inherit underline"
              onClick={() => ideMessenger.post("openUrl", provider.apiKeyUrl!)}
            >
              Click here
            </a>{" "}
            to create a {provider.title} API key
          </span>
        )}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="keyStorage">
          Keep the key in
        </label>
        <FormSelect
          id="keyStorage"
          value={storage}
          onChange={(e) => setStorage(e.target.value as KeyStorage)}
        >
          {storageChoices.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </FormSelect>
      </div>
      {storage !== "inline" && !enterKey && (
        <div>
          <label
            className="mb-1 block text-sm font-medium"
            htmlFor="secretName"
          >
            Name
          </label>
          <Input
            id="secretName"
            className="w-full"
            value={secretName}
            onChange={(e) => {
              setSecretName(e.target.value);
              setKeyTouched(true);
            }}
          />
          <span className="mt-1 block text-xs text-description-muted">
            Every model of this provider refers to it as{" "}
            <code>{`\${{ secrets.${secretName || "NAME"} }}`}</code>
          </span>
        </div>
      )}
      {enterKey && (
        <span className="text-xs text-description-muted">
          Saved as <code>{enterKey.secretName}</code>. config.yaml already
          refers to it and is not changed.
        </span>
      )}
      {keyIssue && keyChoice.value !== "" && (
        <span className="text-xs text-warning">{keyIssue}</span>
      )}
    </div>
  );

  if (envCopy) {
    return (
      <div
        className="mx-auto flex max-w-md flex-col gap-4 p-4"
        data-testid="env-copy-prompt"
      >
        <h2 className="m-0 text-center text-lg">Key saved</h2>
        <p className="m-0 text-sm">
          The key is in secure storage, which Continue reads first.{" "}
          <code>{envCopy}</code> is also set in plaintext in{" "}
          <code>~/.continue/.env</code>. Remove that line?
        </p>
        {error && (
          <div className="text-xs text-error" role="alert">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onDone}>
            Keep it
          </Button>
          <Button
            className="flex-1"
            disabled={removingEnvCopy}
            onClick={removeEnvCopy}
          >
            Remove from .env
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex max-w-md flex-col gap-4 p-4"
      data-testid="provider-setup-flow"
    >
      <h2 className="m-0 text-center text-lg">
        {enterKey
          ? `Enter your ${provider.title} key`
          : initialConnection
            ? `Edit ${provider.title}`
            : "Set up models"}
      </h2>

      {!enterKey && (
        <div className="text-center text-xs text-description-muted">
          Step {step === "credentials" ? 1 : step === "models" ? 2 : 3} of 3
        </div>
      )}

      {step === "credentials" && (
        <div className="flex flex-col gap-4">
          {!enterKey && !initialConnection && (
            <div>
              <label className="block text-sm font-medium">Provider</label>
              <ModelSelectionListbox
                selectedProvider={provider}
                setSelectedProvider={(val: DisplayInfo) => {
                  const match = [...lists.popular, ...lists.other].find(
                    (p) => p.title === val.title,
                  );
                  if (match) {
                    formMethods.setValue("apiKey", "");
                    setProvider(match);
                  }
                }}
                topOptions={lists.popular}
                otherOptions={lists.other}
                searchPlaceholder="Search providers..."
              />
            </div>
          )}

          {!enterKey && isLocal && (
            <LocalServerPicker
              apiBase={connection.apiBase}
              onPick={(apiBase, server) => {
                formMethods.setValue("apiBase", apiBase);
                setDetectedName(server?.title);
                setRefreshError(undefined);
                setLiveModels(
                  server && server.models.length > 0
                    ? fetchedToPackages(server.models, provider.provider)
                    : [],
                );
              }}
            />
          )}

          {keySection}

          {!enterKey &&
            getRenderableFields(provider, values).map((field) => (
              <div key={`${provider.provider}-${field.key}`}>
                <label
                  className="mb-1 block text-sm font-medium"
                  htmlFor={field.key}
                >
                  {field.label}
                </label>
                {field.inputType === "select" ? (
                  <FormSelect
                    id={field.key}
                    defaultValue={field.defaultValue}
                    {...formMethods.register(field.key)}
                  >
                    {(
                      field.choices ??
                      (field.options ?? []).map((o) => ({ value: o, label: o }))
                    ).map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </FormSelect>
                ) : (
                  <Input
                    id={field.key}
                    className="w-full"
                    type={field.inputType === "password" ? "password" : "text"}
                    defaultValue={field.defaultValue}
                    placeholder={`${field.placeholder ?? ""}`}
                    {...formMethods.register(field.key)}
                  />
                )}
                {field.description && (
                  <span className="mt-1 block text-xs text-description-muted">
                    {field.description}
                  </span>
                )}
              </div>
            ))}

          {!enterKey && isBedrock && (
            <BedrockConnectionTester
              connection={getBedrockConnectionParams(
                provider,
                provider.packages[0],
                values,
              )}
              model={provider.packages[0].params.model}
              canTest={fieldsFilled}
              onModelsLoaded={(models) => {
                setRefreshError(undefined);
                if (!models) setLiveModels([]);
                else applyBedrock(models);
              }}
            />
          )}

          {error && (
            <div className="text-xs text-error" role="alert">
              {error}
            </div>
          )}
          {warning && <div className="text-xs text-warning">{warning}</div>}

          <div className="flex gap-2">
            {onCancel && (
              <Button variant="secondary" onClick={onCancel} className="flex-1">
                Cancel
              </Button>
            )}
            {enterKey ? (
              <Button
                className="flex-1"
                disabled={!canContinue || saving}
                onClick={saveKeyOnly}
              >
                Save key
              </Button>
            ) : (
              <Button
                className="flex-1"
                disabled={!canContinue}
                onClick={() => {
                  setStep("models");
                  // A local server's own list is the only one that applies.
                  if (isLocal && liveModels.length === 0) void refreshModels();
                }}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      )}

      {step === "models" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Models</label>
            <button
              type="button"
              aria-label="Refresh model list"
              title="Use the entered credentials to list the models available to you"
              className={`cursor-pointer border-none bg-transparent p-0 ${
                canRefresh
                  ? "text-description-muted hover:text-foreground"
                  : "invisible"
              }`}
              onClick={refreshModels}
              disabled={refreshing}
            >
              <ArrowPathIcon
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          {refreshError && (
            <span className="text-xs whitespace-pre-wrap text-warning">
              Couldn't refresh the model list: {refreshError}
            </span>
          )}
          <ModelChecklist
            groups={groups}
            checked={checked}
            onToggle={toggle}
            isLive={modelLists.isLive}
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setStep("credentials")}
            >
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={!hasChanges}
              onClick={() => setStep("review")}
            >
              Review
            </Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="flex flex-col gap-3">
          <ReviewStep
            providerTitle={provider.title}
            diff={diff}
            keyPlan={describeKeyPlan(keyForRequest, provider.title)}
            connectionChange={
              connectionMoved && editing
                ? {
                    from: describeConnection(editing),
                    to: describeConnection(connection),
                    modelCount: configuredModels.length,
                  }
                : undefined
            }
            confirmedRemoval={confirmedRemoval}
            onConfirmRemoval={setConfirmedRemoval}
            account={accountForSave}
            error={error}
            warning={warning}
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setStep("models")}
            >
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={needsConfirm || saving || !hasChanges}
              onClick={save}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
