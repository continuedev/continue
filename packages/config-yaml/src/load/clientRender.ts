import { z } from "zod";
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
  PackageIdentifier,
} from "../interfaces/slugs.js";
import { AssistantUnrolled } from "../schemas/index.js";
import {
  fillTemplateVariables,
  getTemplateVariables,
  parseAssistantUnrolled,
} from "./unroll.js";

export async function renderSecrets(
  packageIdentifier: PackageIdentifier,
  unrolledConfigContent: string,
  clientSecretStore: SecretStore,
  orgScopeId: string | null, // The "scope" that the user is logged in with
  onPremProxyUrl: string | null,
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
  const finalConfig = useProxyForUnrenderedSecrets(
    parsedYaml,
    packageIdentifier,
    orgScopeId,
    onPremProxyUrl,
  );
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

export function packageIdentifierToShorthandSlug(
  id: PackageIdentifier,
): string {
  switch (id.uriType) {
    case "slug":
      return `${id.fullSlug.ownerSlug}/${id.fullSlug.packageSlug}`;
    case "file":
      return "/";
  }
}

function getContinueProxyModelName(
  packageIdentifier: PackageIdentifier,
  provider: string,
  model: string,
): string {
  return `${packageIdentifierToShorthandSlug(packageIdentifier)}/${provider}/${model}`;
}

export function useProxyForUnrenderedSecrets(
  config: AssistantUnrolled,
  packageIdentifier: PackageIdentifier,
  orgScopeId: string | null,
  onPremProxyUrl: string | null,
): AssistantUnrolled {
  if (config.models) {
    for (let i = 0; i < config.models.length; i++) {
      const apiKeyLocation = getUnrenderedSecretLocation(
        config.models[i]?.apiKey,
      );
      const encodedApiKeyLocation = apiKeyLocation
        ? encodeSecretLocation(apiKeyLocation)
        : undefined;

      let encodedEnvSecretLocations: Record<string, string> | undefined =
        undefined;
      if (config.models[i]?.env) {
        Object.entries(config.models[i]?.env!).forEach(([key, value]) => {
          if (typeof value === "string") {
            const secretLocation = getUnrenderedSecretLocation(value);
            if (secretLocation) {
              encodedEnvSecretLocations = {
                ...encodedEnvSecretLocations,
                [key]: encodeSecretLocation(secretLocation),
              };
            }
          }
        });
      }

      if (encodedApiKeyLocation || encodedEnvSecretLocations) {
        config.models[i] = {
          ...config.models[i],
          name: config.models[i]?.name ?? "",
          provider: "continue-proxy",
          model: getContinueProxyModelName(
            packageIdentifier,
            config.models[i]?.provider ?? "",
            config.models[i]?.model ?? "",
          ),
          apiKeyLocation: encodedApiKeyLocation,
          envSecretLocations: encodedEnvSecretLocations,
          orgScopeId,
          onPremProxyUrl,
          apiKey: undefined,
        };
      }
    }
  }

  return config;
}

/** The additional properties that are added to the otherwise OpenAI-compatible body when requesting a Continue proxy */
export const continuePropertiesSchema = z.object({
  apiKeyLocation: z.string().optional(),
  envSecretLocations: z.record(z.string(), z.string()).optional(),
  apiBase: z.string().optional(),
  orgScopeId: z.string().nullable(),
  env: z.record(z.string(), z.any()).optional(),
});

export type ContinueProperties = z.infer<typeof continuePropertiesSchema>;
