import * as YAML from "yaml";
import { getBasename } from "../../util";

export function extractName(preamble: { name?: string }, path: string): string {
  return preamble.name ?? getBasename(path).split(".prompt")[0];
}

export function parsePreamble(
  path: string,
  content: string,
): { [key: string]: any; name: string; description: string } {
  let [preambleRaw, prompt] = content.split("\n---\n");
  if (prompt === undefined) {
    // This means there is no preamble
    preambleRaw = "";
  }

  const preamble = YAML.parse(preambleRaw) ?? {};
  const name = extractName(preamble, path);
  const description = preamble.description ?? name;

  return {
    ...preamble,
    name,
    description,
  };
}
