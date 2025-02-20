import {
  clientRender,
  PackageSlug,
  PlatformClient,
  SecretStore,
} from "@continuedev/config-yaml";

import { IDE } from "../..";
import { ControlPlaneClient } from "../../control-plane/client";

export async function clientRenderHelper(
  packageSlug: PackageSlug,
  unrolledAssistant: string,
  orgScopeId: string | null,
  ide: IDE,
  controlPlaneClient: ControlPlaneClient,
) {
  const ideSecretStore: SecretStore = {
    get: async function (secretName: string): Promise<string | undefined> {
      const results = await ide.readSecrets([secretName]);
      return results[secretName];
    },
    set: async function (
      secretName: string,
      secretValue: string,
    ): Promise<void> {
      return await ide.writeSecrets({
        [secretName]: secretValue,
      });
    },
  };

  const platformClient: PlatformClient = {
    resolveFQSNs: controlPlaneClient.resolveFQSNs.bind(controlPlaneClient),
  };

  const userId = await controlPlaneClient.userId;
  return await clientRender(
    packageSlug,
    unrolledAssistant,
    ideSecretStore,
    orgScopeId,
    userId ? platformClient : undefined,
  );
}
