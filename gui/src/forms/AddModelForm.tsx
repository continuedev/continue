import { useContext, useState } from "react";
import { Button, Input } from "../components";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { fetchProviderModels } from "../pages/AddNewModel/configs/fetchProviderModels";
import type { ModelPackage } from "../pages/AddNewModel/configs/models";

export function AddModelForm({ onDone }: { onDone: () => void }) {
  const ideMessenger = useContext(IdeMessengerContext);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("anthropic/claude-sonnet-4.6");
  const [models, setModels] = useState<ModelPackage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadModels() {
    setBusy(true);
    setError("");
    try {
      const result = await fetchProviderModels(
        ideMessenger,
        "vercel-ai-gateway",
        apiKey.trim(),
      );
      setModels(result);
      if (!result.length)
        setError(
          "No models returned. Check your Gateway API key and connection.",
        );
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const selected = models.find(
        (entry) => entry.params.model === model.trim(),
      );
      const response = await ideMessenger.request("config/addModel", {
        model: {
          ...selected?.params,
          title: `${model.trim()} (Gateway)`,
          provider: "vercel-ai-gateway",
          underlyingProviderName: "vercel-ai-gateway",
          model: model.trim(),
          apiKey: apiKey.trim(),
        },
      });
      if (response.status === "error") throw new Error(response.error);
      onDone();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="mx-auto max-w-md space-y-4 p-6"
      onSubmit={(event) => {
        event.preventDefault();
        void connect();
      }}
    >
      <h1 className="text-xl">Add Gateway chat model</h1>
      <p className="text-description text-sm">
        Choose a model from Vercel AI Gateway. All inference uses your Gateway
        account.
      </p>
      <label className="block text-sm">
        Gateway API key
        <Input
          className="mt-1 w-full"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          required
        />
      </label>
      <Button
        type="button"
        disabled={busy || !apiKey.trim()}
        onClick={() => void loadModels()}
      >
        Load available models
      </Button>
      <label className="block text-sm">
        Model ID
        <Input
          className="mt-1 w-full"
          list="gateway-models"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder="publisher/model"
          required
        />
      </label>
      <datalist id="gateway-models">
        {models.map((entry) => (
          <option key={entry.params.model} value={entry.params.model}>
            {entry.title}
          </option>
        ))}
      </datalist>
      {error && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}
      <p className="text-description text-xs">
        Your key is saved in your local Ruckus configuration. Other model
        roles can be assigned in the config file.
      </p>
      <Button
        type="submit"
        className="w-full"
        disabled={
          busy || !apiKey.trim() || !/^[a-z0-9-]+\/[^\s]+$/.test(model.trim())
        }
      >
        {busy ? "Working…" : "Add model"}
      </Button>
    </form>
  );
}

export default AddModelForm;
