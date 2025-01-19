import * as YAML from "yaml";
import { PlatformClient, SecretStore } from "../interfaces/index.js";
import { encodeSecretLocation } from "../interfaces/SecretResult.js";
import { FQSN, decodeFQSN, encodeFQSN } from "../interfaces/slugs.js";
import { ConfigYaml } from "../schemas/index.js";
import {
  fillTemplateVariables,
  getTemplateVariables,
  parseConfigYaml,
} from "./unroll.js";

export async function clientRender(
  unrolledConfig: ConfigYaml,
  secretStore: SecretStore,
  platformClient: PlatformClient,
): Promise<ConfigYaml> {
  const rawYaml = YAML.stringify(unrolledConfig);

  // 1. First we need to get a list of all the FQSNs that are required to render the config
  const secrets = getTemplateVariables(rawYaml);

  // 2. Then, we will check which of the secrets are found in the local personal secret store. Here we’re checking for anything that matches the last part of the FQSN, not worrying about the owner/package/owner/package slugs
  const secretsTemplateData: Record<string, string> = {};

  const unresolvedFQSNs: FQSN[] = [];
  for (const secret of secrets) {
    const fqsn = decodeFQSN(secret.replace("secrets.", ""));
    const secretValue = await secretStore.get(fqsn.secretName);
    if (secretValue) {
      secretsTemplateData[secret] = secretValue;
    } else {
      unresolvedFQSNs.push(fqsn);
    }
  }

  // 3. For any secrets not found, we send the FQSNs to the Continue Platform at the `/ide/sync-secrets` endpoint. This endpoint replies for each of the FQSNs with the following information (`SecretResult`): `foundAt`: tells which secret store it was found in (this is “user”, “org”, “package” or null if not found anywhere). If it’s found in an org or a package, it tells us the `secretLocation`, which is either just an org slug, or is a full org/package slug. If it’s found in “user” secrets, we send back the `value`. Full definition of `SecretResult` at [2]. The method of resolving an FQSN to a `SecretResult` is detailed at [3]
  const secretResults = await platformClient.resolveFQSNs(unresolvedFQSNs);

  // 4. (back to the client) Any “user” secrets that were returned back are added to the local secret store so we don’t have to request them again
  for (const secretResult of secretResults) {
    if (!secretResult?.found) continue;

    if ("value" in secretResult) {
      secretStore.set(secretResult.fqsn.secretName, secretResult.value);
    }

    secretsTemplateData["secrets." + encodeFQSN(secretResult.fqsn)] =
      "value" in secretResult
        ? secretResult.value
        : `\${{ secrets.${encodeSecretLocation(secretResult.secretLocation)} }}`;
  }

  // 5. User secrets are rendered in place of the template variable. Others remain templated, but replaced with the specific location where they are to be found (`${{ secrets.<secretLocation> }}` instead of `${{ secrets.<FQSN> }}`)
  const renderedYaml = fillTemplateVariables(rawYaml, secretsTemplateData);

  // 6. The rendered YAML is parsed and validated again
  const finalParsedYaml = parseConfigYaml(renderedYaml);
  return finalParsedYaml;
}
