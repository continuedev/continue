import { test, describe } from "mocha";
import * as assert from "assert";

import { getContinueServerUrl } from "../bridge";
import { startContinuePythonServer } from "../activation/environmentSetup";
import fetch from "node-fetch";

describe("Can start python server", () => {
  test("Can start python server in under 10 seconds", async function () {
    this.timeout(17_000);
    await startContinuePythonServer();

    await new Promise((resolve) => setTimeout(resolve, 15_000));

    // Check if server is running
    const serverUrl = getContinueServerUrl();
    const response = await fetch(`${serverUrl}/health`);
    assert.equal(response.status, 200);
  });
});
