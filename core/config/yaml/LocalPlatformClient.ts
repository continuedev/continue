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

  /**
   * searches for the first valid secret file in order of ~/.continue/.env, <workspace>/.continue/.env, <workspace>/.env
   */
  private async findSecretInEnvFiles(
    fqsn: FQSN,
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
        `Error reading ~/.continue/.env file: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }

  private async findSecretInWorkspaceEnvFiles(
    fqsn: FQSN,
    insideContinue: boolean,
  ): Promise<string | undefined> {
    try {
      const workspaceDirs = await this.ide.getWorkspaceDirs();

      for (const folder of workspaceDirs) {
        const envFilePath = joinPathsToUri(
          folder,
          insideContinue ? ".continue" : "",
          ".env",
        );
        try {
          const fileExists = await this.ide.fileExists(envFilePath);
          if (fileExists) {
            const envContent = await this.ide.readFile(envFilePath);
            const env = dotenv.parse(envContent);
            if (fqsn.secretName in env) {
              console.log('debug1 secretname', fqsn.secretName, 'envfilepath', envFilePath);
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

  async resolveFQSNs(fqsns: FQSN[]): Promise<(SecretResult | undefined)[]> {
    if (fqsns.length === 0) {
      return [];
    }

    const results = await this.client.resolveFQSNs(fqsns, this.orgScopeId);

    // For any secret that isn't found, look in .env files
    for (let i = 0; i < results.length; i++) {
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
