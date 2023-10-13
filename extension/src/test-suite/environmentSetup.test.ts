import { test, describe } from "mocha";
import * as assert from "assert";

import { getContinueServerUrl } from "../bridge";
import { startContinuePythonServer } from "../activation/environmentSetup";
import fetch from "node-fetch";

describe("Can start python server", () => {
  test("Can start python server in under 80 seconds", async function () {
    const allowedTime = 80_000;
    this.timeout(allowedTime + 10_000);

    console.log("Starting server in test...");
    await startContinuePythonServer(false);
    console.log("Server started.");

    // If successful, the server is started by the extension while we wait
    await new Promise((resolve) => setTimeout(resolve, allowedTime));

    // Check if server is running
    const serverUrl = getContinueServerUrl();
    console.log("Server URL: ", serverUrl);
    const response = await fetch(`${serverUrl}/health`);
    assert.equal(response.status, 200);
  });
});
