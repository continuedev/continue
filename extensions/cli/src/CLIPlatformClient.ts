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

    // Try to resolve secrets through the API client first
    try {
      const apiResults: any = await this.apiClient.syncSecrets({
        syncSecretsRequest: {
          fqsns,
          orgScopeId: this.orgScopeId,
        },
      });

      // Merge API results into our results array
      for (let i = 0; i < apiResults.length; i++) {
        if (apiResults[i]?.found) {
          results[i] = apiResults[i];
        }
      }
    } catch (error) {
      console.warn(
        `Error resolving FQSNs through API: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    // For any secret that wasn't found via API, look in local .env files
    for (let i = 0; i < fqsns.length; i++) {
      if (!results[i]?.found) {
        const secretFromEnv = this.findSecretInLocalEnvFiles(fqsns[i]);
        if (secretFromEnv?.found) {
          results[i] = secretFromEnv;
        }
      }
    }

    return results;
  }
}
