import * as fs from "node:fs";
import * as path from "node:path";

import {
  FQSN,
  PlatformClient,
  SecretResult,
  SecretType,
} from "@continuedev/config-yaml";
import { DefaultApiInterface } from "@continuedev/sdk/dist/api";
import * as dotenv from "dotenv";

import { env } from "./env.js";

export class CLIPlatformClient implements PlatformClient {
  constructor(
    private orgScopeId: string | null,
    private readonly apiClient: DefaultApiInterface,
  ) {}

  private findSecretInEnvFile(
    filePath: string,
    secretName: string,
  ): string | undefined {
    try {
      if (!fs.existsSync(filePath)) return undefined;

      const envContent = fs.readFileSync(filePath, "utf8");
      const env = dotenv.parse(envContent);
      return env[secretName];
    } catch (error) {
      console.warn(
        `Error reading .env file at ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return undefined;
    }
  }

  private findSecretInProcessEnv(fqsn: FQSN): SecretResult | undefined {
    const secretValue = process.env[fqsn.secretName];
    if (secretValue) {
      return {
        found: true,
        fqsn,
        value: secretValue,
        secretLocation: {
          secretName: fqsn.secretName,
          secretType: SecretType.LocalEnv,
        },
      };
    }
    return undefined;
  }

  private findSecretInLocalEnvFiles(fqsn: FQSN): SecretResult | undefined {
    // First check process.env (highest priority)
    const processEnvSecret = this.findSecretInProcessEnv(fqsn);
    if (processEnvSecret) {
      return processEnvSecret;
    }

    // Then check in priority order: ~/.continue/.env, <workspace>/.continue/.env, <workspace>/.env
    const workspaceDir = process.cwd();
    const envPaths = [
      path.join(env.continueHome, ".env"),
      path.join(workspaceDir, ".continue", ".env"),
      path.join(workspaceDir, ".env"),
    ];

    for (const envPath of envPaths) {
      const secretValue = this.findSecretInEnvFile(envPath, fqsn.secretName);
      if (secretValue) {
        return {
          found: true,
          fqsn,
          value: secretValue,
          secretLocation: {
            secretName: fqsn.secretName,
            secretType: SecretType.LocalEnv,
          },
        };
      }
    }

    return undefined;
  }

  async resolveFQSNs(fqsns: FQSN[]): Promise<(SecretResult | undefined)[]> {
    if (fqsns.length === 0) {
      return [];
    }

    const results: (SecretResult | undefined)[] = new Array(fqsns.length).fill(
      undefined,
    );

    // First, check local env files for secrets (highest priority for CLI)
    // This allows users to override any secret with a local environment variable
    for (let i = 0; i < fqsns.length; i++) {
      const secretFromEnv = this.findSecretInLocalEnvFiles(fqsns[i]);
      if (secretFromEnv?.found) {
        results[i] = secretFromEnv;
      }
    }

    // For secrets not found locally, try to resolve through the API
    const unresolvedIndices = results
      .map((r, i) => (r === undefined ? i : -1))
      .filter((i) => i !== -1);

    if (unresolvedIndices.length > 0) {
      try {
        const unresolvedFqsns = unresolvedIndices.map((i) => fqsns[i]);
        const apiResults: any = await this.apiClient.syncSecrets({
          syncSecretsRequest: {
            fqsns: unresolvedFqsns,
            orgScopeId: this.orgScopeId,
          },
        });

        // Merge API results - keep all found results (with or without value)
        // Results with value = user secrets (rendered directly)
        // Results with secretLocation but no value = org/package/models_add_on/free_trial (will be proxied)
        for (let j = 0; j < apiResults.length; j++) {
          if (apiResults[j]?.found) {
            results[unresolvedIndices[j]] = apiResults[j];
          }
        }
      } catch (error) {
        console.warn(
          `Error resolving FQSNs through API: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return results;
  }
}
