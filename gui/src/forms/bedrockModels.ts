import type {
  BedrockConnectionParams,
  BedrockListModelsResult,
} from "core/protocol/core";
import type { IIdeMessenger } from "../context/IdeMessenger";
import { BedrockEndpointModel, mergeBedrockEndpoints } from "./modelListUtils";

/** Ask core which models the entered credentials/region can use on one endpoint. */
export async function listBedrockModels(
  ideMessenger: IIdeMessenger,
  connection: Record<string, string>,
): Promise<BedrockListModelsResult> {
  try {
    const res = await ideMessenger.request(
      "bedrock/listModels",
      connection as BedrockConnectionParams,
    );
    return res.status === "success"
      ? res.content
      : { ok: false, error: String(res.error ?? "Request failed") };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type BedrockAllModelsResult =
  | { ok: true; models: BedrockEndpointModel[]; notes: string[] }
  | { ok: false; error: string };

const firstLine = (text: string) => text.split("\n")[0].trim();

/**
 * List models for the form's endpoint. A Mantle connection (`endpoint:
 * "mantle"`) lists only Mantle. Otherwise both endpoints are merged, so one
 * "Amazon Bedrock" entry can offer standard and Mantle-only models together.
 */
export async function listBedrockModelsFor(
  ideMessenger: IIdeMessenger,
  connection: Record<string, string>,
): Promise<BedrockAllModelsResult> {
  if (connection.endpoint === "mantle") {
    const only = await listBedrockModels(ideMessenger, connection);
    return only.ok
      ? {
          ok: true,
          models: only.models.map((m) => ({
            ...m,
            endpoint: "mantle" as const,
          })),
          notes: [],
        }
      : only;
  }
  return listBedrockModelsAcrossEndpoints(ideMessenger, connection);
}

/**
 * List the models available on both Bedrock endpoints and merge them.
 *
 * The standard endpoint is always queried. Mantle is queried too when a Bedrock
 * API key was entered (it only accepts one). A problem on one endpoint does not
 * hide the other's models: it is reported in `notes` instead.
 */
export async function listBedrockModelsAcrossEndpoints(
  ideMessenger: IIdeMessenger,
  connection: Record<string, string>,
): Promise<BedrockAllModelsResult> {
  const tryMantle = !!connection.apiKey;
  const [runtime, mantle] = await Promise.all([
    listBedrockModels(ideMessenger, connection),
    tryMantle
      ? listBedrockModels(ideMessenger, { ...connection, endpoint: "mantle" })
      : Promise.resolve(undefined),
  ]);

  const notes: string[] = [];
  if (!tryMantle) {
    notes.push(
      "Add a Bedrock API key to also list models that are only on the Mantle endpoint.",
    );
  }

  if (!runtime.ok && (!mantle || !mantle.ok)) {
    return { ok: false, error: runtime.error };
  }
  if (!runtime.ok) {
    notes.push(`Standard endpoint unavailable: ${firstLine(runtime.error)}`);
  }
  if (mantle && !mantle.ok) {
    notes.push(`Mantle models unavailable: ${firstLine(mantle.error)}`);
  }

  return {
    ok: true,
    models: mergeBedrockEndpoints(
      runtime.ok ? runtime.models : [],
      mantle?.ok ? mantle.models : [],
    ),
    notes,
  };
}
