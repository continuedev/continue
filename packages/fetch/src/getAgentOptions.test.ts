import { globalAgent } from "https";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { CertsCache } from "./certs.js";
import { getAgentOptions } from "./getAgentOptions.js";

// Store original env
const originalEnv = process.env;
const originalGlobalAgentOptions = { ...globalAgent.options };

// Temporary directory for test certificate files
let tempDir: string;

beforeEach(() => {
  // Create a temporary directory for test files
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fetch-test-"));

  process.env = { ...originalEnv };

  // Reset globalAgent for each test
  globalAgent.options = { ...originalGlobalAgentOptions };
});

afterEach(() => {
  process.env = originalEnv;
  globalAgent.options = originalGlobalAgentOptions;

  CertsCache.getInstance().clear();

  // Clean up temporary directory
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.error(`Failed to remove temp directory: ${error}`);
  }
});

// Helper function to create test certificate files
function createTestCertFile(filename: string, content: string): string {
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

test("getAgentOptions returns basic configuration with default values", async () => {
  const options = await getAgentOptions();

  // Check default timeout (7200 seconds = 2 hours = 7,200,000 ms)
  expect(options.timeout).toBe(7200000);
  expect(options.sessionTimeout).toBe(7200000);
  expect(options.keepAlive).toBe(true);

  // Verify certificates array exists and contains items
  expect(options.ca).toBeInstanceOf(Array);
  expect(options.ca.length).toBeGreaterThan(0);

  // Verify at least one of the real TLS root certificates is included
  // This assumes there's at least one certificate with "CERTIFICATE" in it
  expect(options.ca.some((cert: any) => cert.includes("CERTIFICATE"))).toBe(
    true,
  );
});

test("getAgentOptions respects custom timeout", async () => {
  const customTimeout = 300; // 5 minutes
  const options = await getAgentOptions({ timeout: customTimeout });

  // Check timeout values (300 seconds = 300,000 ms)
  expect(options.timeout).toBe(300000);
  expect(options.sessionTimeout).toBe(300000);
});

test("getAgentOptions uses verifySsl setting", async () => {
  // With verifySsl true
  let options = await getAgentOptions({ verifySsl: true });
  expect(options.rejectUnauthorized).toBe(true);

  // With verifySsl false
  options = await getAgentOptions({ verifySsl: false });
  expect(options.rejectUnauthorized).toBe(false);
});

test("getAgentOptions incorporates custom CA bundle paths", async () => {
  // Create a test CA bundle file
  const caBundleContent =
    "-----BEGIN CERTIFICATE-----\nMIIDtTCCAp2gAwIBAgIJAMcuSp7chAYdMA==\n-----END CERTIFICATE-----";
  const caBundlePath = createTestCertFile("ca-bundle.pem", caBundleContent);

  // Single string path
  let options = await getAgentOptions({ caBundlePath });

  // Verify that our test certificate is included in the CA list
  expect(options.ca).toContain(caBundleContent);

  // Create multiple test CA bundle files
  const caContent1 =
    "-----BEGIN CERTIFICATE-----\nABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789\n-----END CERTIFICATE-----";
  const caContent2 =
    "-----BEGIN CERTIFICATE-----\n0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ\n-----END CERTIFICATE-----";
  const caPath1 = createTestCertFile("ca1.pem", caContent1);
  const caPath2 = createTestCertFile("ca2.pem", caContent2);

  // Array of paths
  options = await getAgentOptions({
    caBundlePath: [caPath1, caPath2],
  });

  // Verify that both test certificates are included in the CA list
  expect(options.ca).toContain(caContent1);
  expect(options.ca).toContain(caContent2);
});

test("getAgentOptions includes global certs when running as binary", async () => {
  // Set up test certs in globalAgent
  globalAgent.options.ca = ["global-cert-1", "global-cert-2"];

  // Set IS_BINARY environment variable
  process.env.IS_BINARY = "true";

  const options = await getAgentOptions();

  // Test for global certs
  expect(options.ca).toContain("global-cert-1");
  expect(options.ca).toContain("global-cert-2");
});

test("getAgentOptions handles client certificate configuration", async () => {
  // Create test certificate files
  const clientCertContent =
    "-----BEGIN CERTIFICATE-----\nCLIENTCERT\n-----END CERTIFICATE-----";
  const clientKeyContent =
    "-----BEGIN PRIVATE KEY-----\nCLIENTKEY\n-----END PRIVATE KEY-----";
  const certPath = createTestCertFile("client.cert", clientCertContent);
  const keyPath = createTestCertFile("client.key", clientKeyContent);

  const clientCertOptions = {
    clientCertificate: {
      cert: certPath,
      key: keyPath,
      passphrase: "secret-passphrase",
    },
  };

  const options = await getAgentOptions(clientCertOptions);

  expect(options.cert).toBe(clientCertContent);
  expect(options.key).toBe(clientKeyContent);
  expect(options.passphrase).toBe("secret-passphrase");
});

test("getAgentOptions handles client certificate without passphrase", async () => {
  // Create test certificate files
  const clientCertContent =
    "-----BEGIN CERTIFICATE-----\nCLIENTCERT2\n-----END CERTIFICATE-----";
  const clientKeyContent =
    "-----BEGIN PRIVATE KEY-----\nCLIENTKEY2\n-----END PRIVATE KEY-----";
  const certPath = createTestCertFile("client2.cert", clientCertContent);
  const keyPath = createTestCertFile("client2.key", clientKeyContent);

  const clientCertOptions = {
    clientCertificate: {
      cert: certPath,
      key: keyPath,
    },
  };

  const options = await getAgentOptions(clientCertOptions);

  expect(options.cert).toBe(clientCertContent);
  expect(options.key).toBe(clientKeyContent);
  expect(options.passphrase).toBeUndefined();
});

test("getAgentOptions reads NODE_EXTRA_CA_CERTS", async () => {
  const extraCertContent =
    "-----BEGIN CERTIFICATE-----\nEXTRA_CERT\n-----END CERTIFICATE-----";
  const certPath = createTestCertFile("extra-cert.cert", extraCertContent);

  expect(CertsCache.getInstance().fixedCa).not.toContain(extraCertContent);

  CertsCache.getInstance().clear();

  process.env.NODE_EXTRA_CA_CERTS = certPath;
  expect(CertsCache.getInstance().fixedCa).toContain(extraCertContent);
});
