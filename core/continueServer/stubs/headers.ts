import * as LaunchDarkly from "launchdarkly-node-client-sdk";
import { constants, getTimestamp } from "../../deploy/constants";

const DEFAULT_STRING_VAL = "NONE";

class LaunchDarklyClient {
  private static client: LaunchDarkly.LDClient;

  static async variation(flagKey: string, defaultValue: any) {
    if (!this.client) {
      this.client = LaunchDarkly.initialize("664bda08e3442b0fdf2c8e55", {
        kind: "multi",
      });
      await this.client.waitForInitialization();
    }

    return this.client.variation(flagKey, defaultValue);
  }
}

export async function getHeaders() {
  let a = await LaunchDarklyClient.variation("a", DEFAULT_STRING_VAL);
  if (a === DEFAULT_STRING_VAL) {
    a = undefined;
  }
  let b = await LaunchDarklyClient.variation("b", DEFAULT_STRING_VAL);
  if (b === DEFAULT_STRING_VAL) {
    b = undefined;
  }
  let c = await LaunchDarklyClient.variation("c", DEFAULT_STRING_VAL);
  if (c === DEFAULT_STRING_VAL) {
    c = undefined;
  }
  return { key: constants.c, timestamp: getTimestamp(), a, b, c };
}
