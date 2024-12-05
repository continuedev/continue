import * as YAML from "yaml";
import { ConfigYaml, configYamlSchema } from "./schemas/index.js";

const REGISTRY_URL = "https://registry.continue.dev";
const LATEST = "latest";

function parseUses(uses: string): {
  owner: string;
  packageName: string;
  version: string;
} {
  const [owner, packageNameAndVersion] = uses.split("/");
  const [packageName, version] = packageNameAndVersion.split("@");
  return {
    owner,
    packageName,
    version: version ?? LATEST,
  };
}

function extendConfig(config: ConfigYaml, pkg: ConfigYaml): ConfigYaml {
  return {
    ...config,
    models: [...(config.models ?? []), ...(pkg.models ?? [])],
    context: [...(config.context ?? []), ...(pkg.context ?? [])],
    tools: [...(config.tools ?? []), ...(pkg.tools ?? [])],
    data: [...(config.data ?? []), ...(pkg.data ?? [])],
    mcpServers: [...(config.mcpServers ?? []), ...(pkg.mcpServers ?? [])],
  };
}

export async function resolvePackages(
  configYaml: ConfigYaml,
): Promise<ConfigYaml> {
  if (!configYaml.packages) return configYaml;

  for (const pkgDesc of configYaml.packages) {
    const { owner, packageName, version } = parseUses(pkgDesc.uses);
    const downloadUrl = new URL(
      `/${owner}/${packageName}/${version}`,
      REGISTRY_URL,
    );
    const resp = await fetch(downloadUrl);
    if (!resp.ok) {
      throw new Error(
        `Failed to fetch package ${pkgDesc.uses} from registry: ${resp.statusText}`,
      );
    }
    const downloadBuf = await resp.arrayBuffer();
    const downloadStr = new TextDecoder().decode(downloadBuf);
    const pkg = YAML.parse(downloadStr);

    const validatedPkg = configYamlSchema.parse(pkg);
    configYaml = extendConfig(configYaml, validatedPkg);
  }
  return configYaml;
}

export function renderConfigYaml(configYaml: string): ConfigYaml {
  try {
    const parsed = YAML.parse(configYaml);
    const result = configYamlSchema.parse(parsed);
    return result;
  } catch (e: any) {
    throw new Error(`Failed to parse config yaml: ${e.message}`);
  }
}
