import {
  clientRender,
  PlatformClient,
  SecretStore,
} from "@continuedev/config-yaml";

import { IDE } from "../..";
import { ControlPlaneClient } from "../../control-plane/client";

export function clientRenderHelper(
  unrolledAssistant: string,
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

  return clientRender(unrolledAssistant, ideSecretStore, platformClient);
}
