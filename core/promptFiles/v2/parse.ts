import * as YAML from "yaml";

import { getBasename } from "../../util";

export function extractName(preamble: { name?: string }, path: string): string {
  return preamble.name ?? getBasename(path).split(".prompt")[0];
}

export function getPreambleAndBody(content: string): [string, string] {
  let [preamble, body] = content.split("\n---\n");
  if (body === undefined) {
    // This means there is no preamble
    body = preamble;
    preamble = "";
  }
  return [preamble, body];
}

export function parsePreamble(
  path: string,
  content: string,
): { [key: string]: any; name: string; description: string } {
  const [preambleRaw, _] = getPreambleAndBody(content);

  const preamble = YAML.parse(preambleRaw) ?? {};
  const name = extractName(preamble, path);
  const description = preamble.description ?? name;

  return {
    ...preamble,
    name,
    description,
  };
}
