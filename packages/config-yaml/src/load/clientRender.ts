import { PlatformClient, SecretStore } from "../interfaces/index.js";
import {
  decodeSecretLocation,
  encodeSecretLocation,
  SecretLocation,
} from "../interfaces/SecretResult.js";
import {
  decodeFQSN,
  encodeFQSN,
  FQSN,
  PackageSlug,
} from "../interfaces/slugs.js";
import { AssistantUnrolled } from "../schemas/index.js";
import {
  fillTemplateVariables,
  getTemplateVariables,
  parseAssistantUnrolled,
} from "./unroll.js";

export async function clientRender(
  packageSlug: PackageSlug,
  unrolledConfigContent: string,
  clientSecretStore: SecretStore,
  platformClient?: PlatformClient,
): Promise<AssistantUnrolled> {
  // 1. First we need to get a list of all the FQSNs that are required to render the config
  const secrets = getTemplateVariables(unrolledConfigContent);

  // 2. Then, we will check which of the secrets are found in the local personal secret store. Here we’re checking for anything that matches the last part of the FQSN, not worrying about the owner/package/owner/package slugs
  const secretsTemplateData: Record<string, string> = {};

  const unresolvedFQSNs: FQSN[] = secrets.map((secret) => {
    return decodeFQSN(secret.replace("secrets.", ""));
  });

  // Don't use platform client in local mode
  if (platformClient) {
    // 3. For any secrets not found, we send the FQSNs to the Continue Platform at the `/ide/sync-secrets` endpoint. This endpoint replies for each of the FQSNs with the following information (`SecretResult`): `foundAt`: tells which secret store it was found in (this is “user”, “org”, “package” or null if not found anywhere). If it’s found in an org or a package, it tells us the `secretLocation`, which is either just an org slug, or is a full org/package slug. If it’s found in “user” secrets, we send back the `value`. Full definition of `SecretResult` at [2]. The method of resolving an FQSN to a `SecretResult` is detailed at [3]
    const secretResults = await platformClient.resolveFQSNs(unresolvedFQSNs);

    // 4. (back to the client) Any “user” secrets that were returned back are added to the local secret store so we don’t have to request them again
    for (const secretResult of secretResults) {
      if (!secretResult) {
        continue;
      }

      if ("value" in secretResult) {
        // clientSecretStore.set(secretResult.fqsn.secretName, secretResult.value);
        // const secretValue = await clientSecretStore.get(fqsn.secretName);
        secretsTemplateData[encodeFQSN(secretResult.fqsn)] = secretResult.value;
      }

      secretsTemplateData["secrets." + encodeFQSN(secretResult.fqsn)] =
        "value" in secretResult
          ? secretResult.value
          : `\${{ secrets.${encodeSecretLocation(secretResult.secretLocation)} }}`;
    }
  }

  // 5. User secrets are rendered in place of the template variable. Others remain templated, but replaced with the specific location where they are to be found (`${{ secrets.<secretLocation> }}` instead of `${{ secrets.<FQSN> }}`)
  const renderedYaml = fillTemplateVariables(
    unrolledConfigContent,
    secretsTemplateData,
  );

  // 6. The rendered YAML is parsed and validated again
  const parsedYaml = parseAssistantUnrolled(renderedYaml);

  // 7. We update any of the items with the proxy version if there are un-rendered secrets
  const finalConfig = useProxyForUnrenderedSecrets(parsedYaml, packageSlug);
  return finalConfig;
}

export function getUnrenderedSecretLocation(
  value: string | undefined,
): SecretLocation | undefined {
  if (!value) return undefined;

  const templateVars = getTemplateVariables(value);
  if (templateVars.length === 1) {
    const secretLocationEncoded = templateVars[0].split("secrets.")[1];
    try {
      const secretLocation = decodeSecretLocation(secretLocationEncoded);
      return secretLocation;
    } catch (e) {
      // If it's a templated secret but not a valid secret location, leave it be
      // in case on-prem proxy has the secret in an env variable
      if (templateVars[0].startsWith("secrets.")) {
        return undefined; // TODO
      }
      return undefined;
    }
  }

  return undefined;
}

function getContinueProxyModelName(
  packageSlug: PackageSlug,
  provider: string,
  model: string,
): string {
  return `${packageSlug.ownerSlug}/${packageSlug.packageSlug}/${provider}/${model}`;
}

function useProxyForUnrenderedSecrets(
  config: AssistantUnrolled,
  packageSlug: PackageSlug,
): AssistantUnrolled {
  if (config.models) {
    for (let i = 0; i < config.models.length; i++) {
      const apiKeyLocation = getUnrenderedSecretLocation(
        config.models[i].apiKey,
      );
      if (apiKeyLocation) {
        config.models[i] = {
          ...config.models[i],
          provider: "continue-proxy",
          model: getContinueProxyModelName(
            packageSlug,
            config.models[i].provider,
            config.models[i].model,
          ),
          apiKeyLocation: encodeSecretLocation(apiKeyLocation),
          apiKey: undefined,
        };
      }
    }
  }

  return config;
}
