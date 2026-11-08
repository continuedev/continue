import { useContext, useState } from "react";
import type {
  BedrockConnectionParams,
  BedrockTestModelResult,
} from "core/protocol/core";
import { Button } from "../components/ui/Button";
import Alert from "../components/gui/Alert";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { BedrockAllModelsResult, listBedrockModelsFor } from "./bedrockModels";
import type { BedrockEndpointModel } from "./modelListUtils";

const ANTHROPIC_USE_CASE_NOTICE =
  "Anthropic models on this account need the Anthropic use-case form completed in the Bedrock console before they will work.";

interface Props {
  /** Connection settings built from the current form values. */
  connection: Record<string, string>;
  /** Model that will be saved right now (picked, typed, or the package default). */
  model: string;
  /** Required fields are filled in. */
  canTest: boolean;
  /** Send the test message through Mantle (the selected model is Mantle-only). */
  testEndpoint?: "mantle";
  /**
   * Called with the models available to these credentials (from every endpoint
   * that could be queried) once the connection works, and with `undefined`
   * when a new test starts or it fails. `notes` explains anything left out.
   */
  onModelsLoaded: (
    models: BedrockEndpointModel[] | undefined,
    notes: string[],
  ) => void;
}

/**
 * "Test connection" for the Bedrock add-model form: lists the models available
 * to the entered credentials/region on both Bedrock endpoints (which then
 * populate the Model picker), and can send a one-word test message.
 */
export function BedrockConnectionTester({
  connection,
  model,
  canTest,
  testEndpoint,
  onModelsLoaded,
}: Props) {
  const ideMessenger = useContext(IdeMessengerContext);
  const [listing, setListing] = useState(false);
  const [listResult, setListResult] = useState<BedrockAllModelsResult>();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<BedrockTestModelResult>();

  async function testConnection() {
    setListing(true);
    setListResult(undefined);
    setTestResult(undefined);
    onModelsLoaded(undefined, []);
    try {
      const result = await listBedrockModelsFor(ideMessenger, connection);
      setListResult(result);
      if (result.ok) {
        onModelsLoaded(result.models, result.notes);
      }
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
        ...(testEndpoint ? { endpoint: testEndpoint } : {}),
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
  const mantleOnly = models.filter((m) => m.endpoint === "mantle").length;

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
          <span className="text-xs whitespace-pre-wrap">
            {listResult.error}
          </span>
        </Alert>
      )}

      {listResult?.ok && (
        <Alert type="success" size="sm">
          <span className="text-xs">
            Connected. {models.length} model
            {models.length === 1 ? "" : "s"} available
            {connection.region ? ` in ${connection.region}` : ""}
            {mantleOnly > 0 ? ` (${mantleOnly} only on Mantle)` : ""}. The Model
            list above now shows them.
          </span>
        </Alert>
      )}

      {models.some((m) => m.needsAnthropicUseCase) && (
        <Alert type="warning" size="sm">
          <span className="text-xs">{ANTHROPIC_USE_CASE_NOTICE}</span>
        </Alert>
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
            <span className="text-xs whitespace-pre-wrap">
              {testResult.error}
            </span>
          </Alert>
        ))}
    </div>
  );
}
