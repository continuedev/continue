import { useContext, useState } from "react";
import type {
  BedrockConnectionParams,
  BedrockListModelsResult,
  BedrockModelOptionInfo,
  BedrockTestModelResult,
} from "core/protocol/core";
import { Button } from "../components/ui/Button";
import Alert from "../components/gui/Alert";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { FormSelect } from "./FormSelect";

interface Props {
  /** Connection settings built from the current form values. */
  connection: Record<string, string>;
  /** Model that will be saved right now (picked, typed, or the package default). */
  model: string;
  /** Required fields are filled in. */
  canTest: boolean;
  onPickModel: (model: BedrockModelOptionInfo | undefined) => void;
}

function groupByProvider(models: BedrockModelOptionInfo[]) {
  const groups = new Map<string, BedrockModelOptionInfo[]>();
  for (const m of models) {
    groups.set(m.provider, [...(groups.get(m.provider) ?? []), m]);
  }
  return [...groups.entries()];
}

/**
 * "Test connection" for the Bedrock add-model form: lists the models available
 * to the entered credentials/region, and can send a one-word test message.
 */
export function BedrockConnectionTester({
  connection,
  model,
  canTest,
  onPickModel,
}: Props) {
  const ideMessenger = useContext(IdeMessengerContext);
  const [listing, setListing] = useState(false);
  const [listResult, setListResult] = useState<BedrockListModelsResult>();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<BedrockTestModelResult>();

  async function testConnection() {
    setListing(true);
    setListResult(undefined);
    setTestResult(undefined);
    onPickModel(undefined);
    try {
      const res = await ideMessenger.request(
        "bedrock/listModels",
        connection as BedrockConnectionParams,
      );
      setListResult(
        res.status === "success"
          ? res.content
          : { ok: false, error: String(res.error ?? "Request failed") },
      );
    } catch (e) {
      setListResult({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setListing(false);
    }
  }

  async function sendTestMessage() {
    setTesting(true);
    setTestResult(undefined);
    try {
      const res = await ideMessenger.request("bedrock/testModel", {
        ...(connection as BedrockConnectionParams),
        model,
      });
      setTestResult(
        res.status === "success"
          ? res.content
          : { ok: false, error: String(res.error ?? "Request failed") },
      );
    } catch (e) {
      setTestResult({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setTesting(false);
    }
  }

  const models = listResult?.ok ? listResult.models : [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={testConnection}
          disabled={!canTest || listing}
        >
          {listing ? "Connecting…" : "Test connection"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={sendTestMessage}
          disabled={!canTest || testing || !model}
          title={`Send a tiny test message to ${model}`}
        >
          {testing ? "Sending…" : "Send test message"}
        </Button>
      </div>

      {listResult && !listResult.ok && (
        <Alert type="error" size="sm">
          <span className="whitespace-pre-wrap text-xs">
            {listResult.error}
          </span>
        </Alert>
      )}

      {listResult?.ok && (
        <>
          <Alert type="success" size="sm">
            <span className="text-xs">
              Connected. {models.length} model
              {models.length === 1 ? "" : "s"} available
              {connection.region ? ` in ${connection.region}` : ""}.
            </span>
          </Alert>
          {models.length > 0 && (
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="bedrock-discovered-model"
              >
                Available models
              </label>
              <FormSelect
                id="bedrock-discovered-model"
                defaultValue=""
                onChange={(e) =>
                  onPickModel(models.find((m) => m.id === e.target.value))
                }
              >
                <option value="">Keep the model selected above</option>
                {groupByProvider(models).map(([provider, items]) => (
                  <optgroup key={provider} label={provider}>
                    {items.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.legacy ? " [legacy]" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </FormSelect>
            </div>
          )}
        </>
      )}

      {testResult &&
        (testResult.ok ? (
          <Alert type="success" size="sm">
            <span className="text-xs">
              {testResult.modelId} replied
              {testResult.reply ? ` "${testResult.reply}"` : ""} in{" "}
              {testResult.latencyMs} ms.
            </span>
          </Alert>
        ) : (
          <Alert type="error" size="sm">
            <span className="whitespace-pre-wrap text-xs">
              {testResult.error}
            </span>
          </Alert>
        ))}
    </div>
  );
}
