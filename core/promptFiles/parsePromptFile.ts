import * as YAML from "yaml";

import { getLastNPathParts } from "../util/uri";

export function parsePromptFile(path: string, content: string) {
  let [preambleRaw, prompt] = content.split("\n---\n");
  if (prompt === undefined) {
    prompt = preambleRaw;
    preambleRaw = "";
  }

  const preamble = YAML.parse(preambleRaw) ?? {};
  const name = preamble.name ?? getLastNPathParts(path, 1).split(".prompt")[0];
  const description = preamble.description ?? name;
  const version = preamble.version ?? 2;

  let systemMessage: string | undefined = undefined;
  if (prompt.includes("<system>")) {
    systemMessage = prompt.split("<system>")[1].split("</system>")[0].trim();
    prompt = prompt.split("</system>")[1].trim();
  }

  return { name, description, systemMessage, prompt, version };
}
