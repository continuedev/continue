import {
  FQSN,
  PlatformClient,
  SecretResult,
  SecretType,
} from "@continuedev/config-yaml";
import { DefaultApiInterface } from "@continuedev/sdk/dist/api";
import * as dotenv from "dotenv";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

function getContinueDotEnv() {
  const homeDir = os.homedir();
  if (!homeDir) return {};
  const envPath = path.join(homeDir, ".continue", ".env");
  if (!fs.existsSync(envPath)) return {};
  const envContent = fs.readFileSync(envPath, "utf8");
  return dotenv.parse(envContent);
}

export class CLIPlatformClient implements PlatformClient {
  constructor(
    private orgScopeId: string | null,
    private readonly apiClient: DefaultApiInterface
  ) {}

  // Add any additional methods required by the PlatformClient interface here

  /**
   * Gets the paths to check for workspace files
   * By default, this is just the current working directory
   */
  private getWorkspaceDirs(): string[] {
    return [process.cwd()];
  }

  /**
   * searches for the first valid secret file in order of ~/.continue/.env, <workspace>/.continue/.env, <workspace>/.env
   */
  private async findSecretInEnvFiles(
    fqsn: FQSN
  ): Promise<SecretResult | undefined> {
    const secretValue =
      this.findSecretInLocalEnvFile(fqsn) ??
      (await this.findSecretInWorkspaceEnvFiles(fqsn, true)) ??
      (await this.findSecretInWorkspaceEnvFiles(fqsn, false));

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

  private findSecretInLocalEnvFile(fqsn: FQSN): string | undefined {
    try {
      const dotEnv = getContinueDotEnv();
      return dotEnv[fqsn.secretName];
    } catch (error) {
      console.warn(
        `Error reading ~/.continue/.env file: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return undefined;
    }
  }

  private findSecretInWorkspaceEnvFiles(
    fqsn: FQSN,
    insideContinue: boolean
  ): string | undefined {
    try {
      // Get workspaces to check
      const workspaceDirs = this.getWorkspaceDirs();

      for (const workspaceDir of workspaceDirs) {
        const envFilePath = path.join(
          workspaceDir,
          insideContinue ? ".continue" : "",
          ".env"
        );

        try {
          // Check if file exists using fs
          if (fs.existsSync(envFilePath)) {
            // Read the file
            const envContent = fs.readFileSync(envFilePath, "utf8");
            const env = dotenv.parse(envContent);

            if (fqsn.secretName in env) {
              return env[fqsn.secretName];
            }
          }
        } catch (error) {
          console.warn(
            `Error reading workspace .env file at ${envFilePath}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          // Continue to next workspace folder
        }
      }

      return undefined;
    } catch (error) {
      console.warn(
        `Error searching workspace .env files: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return undefined;
    }
  }

  async resolveFQSNs(fqsns: FQSN[]): Promise<(SecretResult | undefined)[]> {
    if (fqsns.length === 0) {
      return [];
    }

    // Initialize results array with undefined values
    const results: (SecretResult | undefined)[] = new Array(fqsns.length).fill(
      undefined
    );

    // Try to resolve secrets through the API client if available
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
        }`
      );
    }

    // For any secret that isn't found, look in .env files
    for (let i = 0; i < fqsns.length; i++) {
      if (!results[i]?.found) {
        const secretFromEnv = await this.findSecretInEnvFiles(fqsns[i]);
        if (secretFromEnv?.found) {
          results[i] = secretFromEnv;
        }
      }
    }

    return results;
  }
}
