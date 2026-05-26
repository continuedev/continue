import { readFileSync } from "node:fs";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

export const PERPLEXITY_INTEGRATION_HEADER = "X-Pplx-Integration";

export const PERPLEXITY_INTEGRATION_HEADERS = {
  [PERPLEXITY_INTEGRATION_HEADER]: `continue/${packageJson.version}`,
};
