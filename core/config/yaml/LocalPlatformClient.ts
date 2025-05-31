import {
  FQSN,
  PlatformClient,
  SecretResult,
  SecretType,
} from "@continuedev/config-yaml";
import * as dotenv from "dotenv";
import { IDE } from "../..";
import { ControlPlaneClient } from "../../control-plane/client";
import { getContinueDotEnv } from "../../util/paths";
import { joinPathsToUri } from "../../util/uri";

export class LocalPlatformClient implements PlatformClient {
  constructor(
    private orgScopeId: string | null,
    private readonly client: ControlPlaneClient,
    private readonly ide: IDE,
  ) {}

  private async findSecretInEnvFiles(
    fqsn: FQSN,
  ): Promise<SecretResult | undefined> {
    const secretValue =
      this.findSecretInLocalEnvFile(fqsn) ??
      (await this.findSecretInWorkspaceEnvFiles(fqsn));

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
        `Error reading ~/.continue/.env file: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }

  private async findSecretInWorkspaceEnvFiles(
    fqsn: FQSN,
  ): Promise<string | undefined> {
    try {
      const workspaceDirs = await this.ide.getWorkspaceDirs();

      for (const folder of workspaceDirs) {
        const envFilePath = joinPathsToUri(folder, ".env");
        try {
          const fileExists = await this.ide.fileExists(envFilePath);
          if (fileExists) {
            const envContent = await this.ide.readFile(envFilePath);
            const env = dotenv.parse(envContent);
            if (fqsn.secretName in env) {
              return env[fqsn.secretName];
            }
          }
        } catch (error) {
          console.warn(
            `Error reading workspace .env file at ${envFilePath}: ${error instanceof Error ? error.message : String(error)}`,
          );
          // Continue to next workspace folder
        }
      }

      return undefined;
    } catch (error) {
      console.warn(
        `Error searching workspace .env files: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }

  private findSecretInProcessEnv(fqsn: FQSN): string | undefined {
    try {
      const secretValue = process.env[fqsn.secretName];
      return secretValue;
    } catch (error) {
      console.warn(
        `Error reading process.env: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }

  async resolveFQSNs(fqsns: FQSN[]): Promise<(SecretResult | undefined)[]> {
    if (fqsns.length === 0) {
      return [];
    }

    const results: (SecretResult | undefined)[] = new Array(fqsns.length).fill(
      undefined,
    );

    // 1. Try to resolve from local and workspace .env files first
    for (let i = 0; i < fqsns.length; i++) {
      const secretFromEnvFiles = await this.findSecretInEnvFiles(fqsns[i]);
      if (secretFromEnvFiles?.found) {
        results[i] = secretFromEnvFiles;
      }
    }

    // 2. For secrets not found in .env files, try the ControlPlaneClient (Continue API)
    const remainingFqsnsWithIndices: { fqsn: FQSN; originalIndex: number }[] =
      [];
    for (let i = 0; i < fqsns.length; i++) {
      if (!results[i]) {
        remainingFqsnsWithIndices.push({ fqsn: fqsns[i], originalIndex: i });
      }
    }

    if (remainingFqsnsWithIndices.length > 0) {
      const remainingFqsns = remainingFqsnsWithIndices.map((item) => item.fqsn);
      try {
        const apiResults = await this.client.resolveFQSNs(
          remainingFqsns,
          this.orgScopeId,
        );
        apiResults.forEach((apiResult, j) => {
          const originalIndex = remainingFqsnsWithIndices[j].originalIndex;
          if (apiResult?.found) {
            results[originalIndex] = apiResult;
          }
        });
      } catch (error) {
        console.warn(
          `Error resolving secrets from Continue API: ${error instanceof Error ? error.message : String(error)}. Falling back to other methods.`,
        );
        // If API call fails, we'll proceed to process.env for these remainingFqsns
      }
    }

    // 3. For any secret that still isn't found, try process.env
    for (let i = 0; i < fqsns.length; i++) {
      if (!results[i]) {
        const secretValueFromProcessEnv = this.findSecretInProcessEnv(fqsns[i]);
        if (secretValueFromProcessEnv) {
          results[i] = {
            found: true,
            fqsn: fqsns[i],
            value: secretValueFromProcessEnv,
            secretLocation: {
              secretName: fqsns[i].secretName,
              secretType: SecretType.ProcessEnv,
            },
          };
        }
      }
    }

    // For secrets not found anywhere, mark them as not found
    for (let i = 0; i < fqsns.length; i++) {
      if (!results[i]) {
        results[i] = {
          found: false,
          fqsn: fqsns[i],
          secretLocation: {
            secretName: fqsns[i].secretName,
            secretType: SecretType.NotFound,
          },
        };
      }
    }

    return results;
  }
}
