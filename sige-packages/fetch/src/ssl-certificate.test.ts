import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { CertsCache, getCertificateContent } from "./certs.js";
import { getAgentOptions } from "./getAgentOptions.js";

// Store original env
const originalEnv = process.env;

// Temporary directory for test certificate files
let tempDir: string;

beforeEach(() => {
  // Create a temporary directory for test files
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cert-troubleshoot-test-"));
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
  CertsCache.getInstance().clear();

  // Clean up temporary directory
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("SSL certificate handling", () => {
  describe("CA certificate handling", () => {
    test("should handle custom CA bundle from file path", async () => {
      const customCaCert = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKoK/heBjcOuMA0GCSqGSIb3DQEBBQUAMEUxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQwHhcNMTcwODI4MTkzNDA5WhcNMTgwODI4MTkzNDA5WjBF
-----END CERTIFICATE-----`;

      const caCertPath = path.join(tempDir, "ca-bundle.pem");
      fs.writeFileSync(caCertPath, customCaCert);

      const options = await getAgentOptions({ caBundlePath: caCertPath });

      expect(options.ca).toBeDefined();
      expect(Array.isArray(options.ca)).toBe(true);
      expect(options.ca).toContain(customCaCert);
    });

    test("should handle NODE_EXTRA_CA_CERTS environment variable", async () => {
      const extraCaCert = `-----BEGIN CERTIFICATE-----
MIIDUzCCAjugAwIBAgIJALvxFjX5V+/vMA0GCSqGSIb3DQEBCwUAMDgxCzAJBgNV
BAYTAlVTMRAwDgYDVQQIDAdDb21wYW55MRcwFQYDVQQKDA5Db21wYW55IENvcnAw
-----END CERTIFICATE-----`;

      const extraCaPath = path.join(tempDir, "extra-ca.crt");
      fs.writeFileSync(extraCaPath, extraCaCert);

      process.env.NODE_EXTRA_CA_CERTS = extraCaPath;

      const options = await getAgentOptions();

      expect(options.ca).toBeDefined();
      expect(Array.isArray(options.ca)).toBe(true);
      expect(options.ca).toContain(extraCaCert);
    });

    test("should combine NODE_EXTRA_CA_CERTS with custom CA bundle", async () => {
      const extraCaCert = `-----BEGIN CERTIFICATE-----
MIIDExtra1234567890abcdefghijklmnopqrstuvwxyz
-----END CERTIFICATE-----`;

      const customCaCert = `-----BEGIN CERTIFICATE-----
MIIDCustom1234567890abcdefghijklmnopqrstuvwxyz
-----END CERTIFICATE-----`;

      const extraCaPath = path.join(tempDir, "extra-ca.crt");
      const customCaPath = path.join(tempDir, "custom-ca.pem");

      fs.writeFileSync(extraCaPath, extraCaCert);
      fs.writeFileSync(customCaPath, customCaCert);

      process.env.NODE_EXTRA_CA_CERTS = extraCaPath;

      const options = await getAgentOptions({ caBundlePath: customCaPath });

      expect(options.ca).toBeDefined();
      expect(Array.isArray(options.ca)).toBe(true);
      expect(options.ca).toContain(extraCaCert);
      expect(options.ca).toContain(customCaCert);
    });
  });

  describe("Data URI certificate handling", () => {
    test("should handle base64 encoded data URI certificates", () => {
      const originalCert = `-----BEGIN CERTIFICATE-----
MIIDUzCCAjugAwIBAgIJALvxFjX5V+/vMA0GCSqGSIb3DQEB
-----END CERTIFICATE-----`;

      const base64Data = Buffer.from(originalCert).toString("base64");
      const dataUri = `data:application/x-pem-file;base64,${base64Data}`;

      const result = getCertificateContent(dataUri);

      expect(result).toBe(originalCert);
    });

    test("should handle URL-encoded data URI certificates", () => {
      const originalCert =
        "certificate with spaces and special chars: !@#$%^&*()";
      const encodedData = encodeURIComponent(originalCert);
      const dataUri = `data:text/plain,${encodedData}`;

      const result = getCertificateContent(dataUri);

      expect(result).toBe(originalCert);
    });
  });

  describe("SSL/TLS configuration", () => {
    test("should configure SSL verification correctly", async () => {
      // Test with SSL verification enabled
      let options = await getAgentOptions({ verifySsl: true });
      expect(options.rejectUnauthorized).toBe(true);

      // Test with SSL verification disabled
      options = await getAgentOptions({ verifySsl: false });
      expect(options.rejectUnauthorized).toBe(false);
    });

    test("should configure timeout correctly", async () => {
      const customTimeout = 60; // 1 minute in seconds
      const options = await getAgentOptions({ timeout: customTimeout });

      expect(options.timeout).toBe(customTimeout * 1000); // Should be converted to milliseconds
    });

    test("should handle client certificate authentication", async () => {
      const clientCert = `-----BEGIN CERTIFICATE-----
MIIDClientCert1234567890abcdefghijklmnopqrstuvwxyz
-----END CERTIFICATE-----`;

      const clientKey = `-----BEGIN PRIVATE KEY-----
MIIEClientKey567890abcdefghijklmnopqrstuvwxyz
-----END PRIVATE KEY-----`;

      const clientCertPath = path.join(tempDir, "client.crt");
      const clientKeyPath = path.join(tempDir, "client.key");

      fs.writeFileSync(clientCertPath, clientCert);
      fs.writeFileSync(clientKeyPath, clientKey);

      const options = await getAgentOptions({
        clientCertificate: {
          cert: clientCertPath,
          key: clientKeyPath,
          passphrase: "test-passphrase",
        },
      });

      expect(options.cert).toBe(clientCert);
      expect(options.key).toBe(clientKey);
      expect(options.passphrase).toBe("test-passphrase");
    });
  });

  describe("Certificate caching behavior", () => {
    test("should cache certificate content to avoid repeated file reads", async () => {
      const certsCache = CertsCache.getInstance();
      const certPath = path.join(tempDir, "cached-cert.pem");
      const certContent = `-----BEGIN CERTIFICATE-----
MIIDCachedCert1234567890abcdefghijklmnopqrstuvwxyz
-----END CERTIFICATE-----`;

      fs.writeFileSync(certPath, certContent);

      // First call should read from file
      const result1 = await certsCache.getCachedCustomCert(certPath);
      expect(result1).toBe(certContent);

      // Modify the file on disk
      const modifiedContent = certContent.replace("CachedCert", "ModifiedCert");
      fs.writeFileSync(certPath, modifiedContent);

      // Second call should return cached content, not the modified content
      const result2 = await certsCache.getCachedCustomCert(certPath);
      expect(result2).toBe(certContent); // Should still be the original cached content
    });

    test("should handle cache clearing", async () => {
      const certsCache = CertsCache.getInstance();
      const certPath = path.join(tempDir, "clear-cache-cert.pem");
      const originalContent = `-----BEGIN CERTIFICATE-----
MIIDOriginalCert1234567890abcdefghijklmnopqrstuvwxyz
-----END CERTIFICATE-----`;

      fs.writeFileSync(certPath, originalContent);

      // Load into cache
      await certsCache.getCachedCustomCert(certPath);

      // Clear cache
      certsCache.clear();

      // Modify file
      const newContent = originalContent.replace("OriginalCert", "NewCert");
      fs.writeFileSync(certPath, newContent);

      // Should read new content after cache clear
      const result2 = await certsCache.getCachedCustomCert(certPath);
      expect(result2).toBe(newContent);
    });
  });

  describe("Error handling scenarios", () => {
    test("should handle non-existent certificate files gracefully", async () => {
      const nonExistentPath = path.join(tempDir, "does-not-exist.pem");

      // Should not throw but should continue with system certificates only
      const options = await getAgentOptions({ caBundlePath: nonExistentPath });

      expect(options.ca).toBeDefined();
      expect(Array.isArray(options.ca)).toBe(true);
      // Should only contain system certificates, not the missing custom one
      expect(options.ca.length).toBeGreaterThan(0);
    });

    test("should handle empty certificate files", () => {
      const emptyCertPath = path.join(tempDir, "empty-cert.pem");
      fs.writeFileSync(emptyCertPath, "");

      const result = getCertificateContent(emptyCertPath);
      expect(result).toBe("");
    });

    test("should handle malformed data URIs", () => {
      const validMalformedDataUris = ["data:invalid-format", "data:"];

      validMalformedDataUris.forEach((uri) => {
        // These should not throw but may return unexpected content
        expect(() => getCertificateContent(uri)).not.toThrow();
        const result = getCertificateContent(uri);
        expect(typeof result).toBe("string");
      });

      // This one will be treated as a file path and should throw
      expect(() => getCertificateContent("not-a-data-uri-at-all")).toThrow(
        "ENOENT",
      );
    });
  });

  describe("Real-world scenarios", () => {
    test("should handle certificate bundle with multiple certificates", () => {
      const bundleContent = `-----BEGIN CERTIFICATE-----
MIIDRootCA1234567890abcdefghijklmnopqrstuvwxyz
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIDIntermediateCA1234567890abcdefghijklmnopqrstuvwxyz
-----END CERTIFICATE-----`;

      const bundlePath = path.join(tempDir, "ca-bundle.pem");
      fs.writeFileSync(bundlePath, bundleContent);

      const result = getCertificateContent(bundlePath);
      expect(result).toBe(bundleContent);
      expect(result).toContain("RootCA");
      expect(result).toContain("IntermediateCA");
    });

    test("should work with common certificate file extensions", () => {
      const certExtensions = [".pem", ".crt", ".cer"];
      const testCert = `-----BEGIN CERTIFICATE-----
MIIDTestCert1234567890abcdefghijklmnopqrstuvwxyz
-----END CERTIFICATE-----`;

      for (const ext of certExtensions) {
        const certPath = path.join(tempDir, `test-cert${ext}`);
        fs.writeFileSync(certPath, testCert);

        const result = getCertificateContent(certPath);
        expect(result).toBe(testCert);
      }
    });

    test("should handle proxy scenarios with custom certificates", async () => {
      // Test that certificates work properly when proxy might be involved
      const proxyCaCert = `-----BEGIN CERTIFICATE-----
MIIDProxyCA1234567890abcdefghijklmnopqrstuvwxyz
-----END CERTIFICATE-----`;

      const proxyCaPath = path.join(tempDir, "proxy-ca.pem");
      fs.writeFileSync(proxyCaPath, proxyCaCert);

      const options = await getAgentOptions({ caBundlePath: proxyCaPath });

      expect(options.ca).toBeDefined();
      expect(options.ca).toContain(proxyCaCert);
      expect(options.keepAlive).toBe(true); // Should work with keep-alive for proxy scenarios
    });
  });
});
