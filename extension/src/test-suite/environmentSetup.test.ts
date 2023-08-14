import { test, describe } from "mocha";
import * as assert from "assert";

import { getContinueServerUrl } from "../bridge";
import { ideProtocolClient } from "../activation/activate";
import fetch from "node-fetch";
import fkill from "fkill";

describe("Can start python server", () => {
  test("Can start python server in under 35 seconds", async function () {
    const allowedTime = 35_000;
    this.timeout(allowedTime + 10_000);
    try {
      fkill(65432, { force: true, silent: true });
      console.log("Killed existing server");
    } catch (e) {
      console.log("No existing server: ", e);
    }

    // If successful, the server is started by the extension while we wait
    await new Promise((resolve) => setTimeout(resolve, allowedTime));

    // Check if server is running
    const serverUrl = getContinueServerUrl();
    console.log("Server URL: ", serverUrl);
    const response = await fetch(`${serverUrl}/health`);
    assert.equal(response.status, 200);
  });
});
