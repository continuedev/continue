import { ClientConfigYaml, ConfigYaml } from "./schemas/index.js";
type SecretProvider = (
  secretNames: string[],
) => Promise<{ [key: string]: string }>;

/**
 * Take a ConfigYaml with apiKeySecrets, and look to fill in these secrets
 * with whatever secret store exists in the client.
 */
export async function resolveSecretsOnClient(
  configYaml: ClientConfigYaml,
  getSecretsFromClientStore: SecretProvider,
  getSecretsFromServer: SecretProvider,
): Promise<ClientConfigYaml> {
  const requiredSecrets = getRequiredSecretsInClientConfig(configYaml);

  const secretsFoundOnClient = await getSecretsFromClientStore(requiredSecrets);

  const secretsNotFoundOnClient = requiredSecrets.filter(
    (secret) => !secretsFoundOnClient[secret],
  );

  let secretsFoundOnServer = {};
  if (secretsNotFoundOnClient.length > 0) {
    secretsFoundOnServer = await getSecretsFromServer(secretsNotFoundOnClient);
  }

  const clientSecrets = {
    ...secretsFoundOnClient,
    ...secretsFoundOnServer,
  };

  const finalConfigYaml = injectClientSecrets(configYaml, clientSecrets);

  // Anything with an apiKeySecret left over must use proxy
  return finalConfigYaml;
}

function getRequiredSecretsInClientConfig(
  configYaml: ClientConfigYaml,
): string[] {
  const secrets = new Set<string>();
  for (const model of configYaml.models ?? []) {
    if (model.apiKeySecret) {
      secrets.add(model.apiKeySecret);
    }
  }
  return Array.from(secrets);
}

function injectClientSecrets(
  configYaml: ClientConfigYaml,
  clientSecrets: Record<string, string>,
): ConfigYaml {
  for (const model of configYaml.models ?? []) {
    if (model.apiKeySecret && clientSecrets[model.apiKeySecret]) {
      // Remove apiKeySecret and place the client secret in apiKey
      model.apiKey = clientSecrets[model.apiKeySecret];
      delete model.apiKeySecret;
    }
  }

  return configYaml;
}
