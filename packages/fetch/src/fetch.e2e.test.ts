import * as fs from "node:fs";
import * as http from "node:http";
import * as https from "node:https";
import * as os from "node:os";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { afterEach, describe, expect, test } from "vitest";
import { fetchwithRequestOptions } from "./fetch.js";

// Test server ports
const HTTP_PORT = 3001;
const HTTPS_PORT = 3002;

// Track servers and temp dirs for cleanup
const serversToCleanup: Array<http.Server | https.Server> = [];
const tempDirsToCleanup: string[] = [];

afterEach(() => {
  // Clean up all servers
  serversToCleanup.forEach((server) => server.close());
  serversToCleanup.length = 0;

  // Clean up temp directories
  tempDirsToCleanup.forEach((tempDir) => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
  tempDirsToCleanup.length = 0;
});

/**
 * Create a temporary directory for test files
 */
function createTempDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fetch-e2e-test-"));
  tempDirsToCleanup.push(tempDir);
  return tempDir;
}

/**
 * Generate a self-signed certificate for testing
 */
async function generateCertificate(
  tempDir: string,
  name: string,
  options: { cn: string; san: string[]; org: string },
): Promise<{ certPath: string; keyPath: string; caCertPath: string }> {
  const certPath = path.join(tempDir, `${name}.crt`);
  const keyPath = path.join(tempDir, `${name}.key`);
  const caCertPath = path.join(tempDir, `${name}-ca.crt`);

  try {
    // Generate a private key
    execSync(`openssl genrsa -out "${keyPath}" 2048`, { stdio: "pipe" });

    // Create config file for certificate
    const configPath = path.join(tempDir, `${name}.conf`);
    const altNames = options.san
      .map((san, i) => {
        return san.match(/^\d+\.\d+\.\d+\.\d+$/)
          ? `IP.${i + 1} = ${san}`
          : `DNS.${i + 1} = ${san}`;
      })
      .join("\n");

    const configContent = `
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = Test
L = Test
O = ${options.org}
CN = ${options.cn}

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
${altNames}
`;
    fs.writeFileSync(configPath, configContent);

    // Generate a self-signed certificate
    execSync(
      `openssl req -new -x509 -key "${keyPath}" -out "${certPath}" -days 365 -config "${configPath}" -extensions v3_req`,
      { stdio: "pipe" },
    );

    // Copy the certificate as CA (for testing custom CA scenarios)
    fs.copyFileSync(certPath, caCertPath);

    return { certPath, keyPath, caCertPath };
  } catch (error) {
    // Fallback: create minimal test certificates if OpenSSL not available
    const key = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7VJTUt9Us8cKB
wEiOfniel+2jNcJjYUiUoq5YbVKk+xqt4bOMh5DNFJ3LnU1OaUHyG5sHlgNyKA==
-----END PRIVATE KEY-----`;

    const cert = `-----BEGIN CERTIFICATE-----
MIICljCCAX4CCQCKnW9qX7TlxzANBgkqhkiG9w0BAQsFADANMQswCQYDVQQGEwJV
UzAeFw0yNDAxMDEwMDAwMDBaFw0yNTAxMDEwMDAwMDBaMA0xCzAJBgNVBAYTAlVT
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1L7VLPHCQD1OvF4p
4td9ozXCY2FIlKKuWG1SpPsareGzjIeQzRSdy51NTmlB8hubB5YDcigN8=
-----END CERTIFICATE-----`;

    fs.writeFileSync(keyPath, key);
    fs.writeFileSync(certPath, cert);
    fs.writeFileSync(caCertPath, cert);

    return { certPath, keyPath, caCertPath };
  }
}

/**
 * Start a simple HTTP server for testing
 */
async function startHttpServer(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url!, `http://localhost:${HTTP_PORT}`);

    if (url.pathname === "/json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "Hello from HTTP server",
          method: req.method,
        }),
      );
    } else if (url.pathname === "/headers") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ headers: req.headers }));
    } else if (url.pathname === "/body") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ body, headers: req.headers }));
      });
    } else if (url.pathname === "/status/404") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    } else if (url.pathname === "/slow") {
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Slow response");
      }, 100);
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(HTTP_PORT, () => resolve());
  });

  serversToCleanup.push(server);
  return server;
}

/**
 * Start an HTTPS server with given certificates
 */
async function startHttpsServer(
  certPath: string,
  keyPath: string,
): Promise<https.Server> {
  const server = https.createServer(
    {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    },
    (req, res) => {
      const url = new URL(req.url!, `https://localhost:${HTTPS_PORT}`);

      if (url.pathname === "/secure") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ message: "Hello from HTTPS server", secure: true }),
        );
      } else if (url.pathname === "/headers") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ headers: req.headers }));
      } else {
        res.writeHead(404);
        res.end("Not Found");
      }
    },
  );

  await new Promise<void>((resolve) => {
    server.listen(HTTPS_PORT, () => resolve());
  });

  serversToCleanup.push(server);
  return server;
}

describe("fetchwithRequestOptions E2E tests", () => {
  describe("HTTP requests", () => {
    test("should make basic HTTP GET request", async () => {
      await startHttpServer();

      const response = await fetchwithRequestOptions(
        `http://localhost:${HTTP_PORT}/json`,
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        message: string;
        method: string;
      };
      expect(data).toEqual({
        message: "Hello from HTTP server",
        method: "GET",
      });
    });

    test("should make HTTP POST request with body", async () => {
      await startHttpServer();

      const response = await fetchwithRequestOptions(
        `http://localhost:${HTTP_PORT}/json`,
        {
          method: "POST",
          body: JSON.stringify({ test: "data" }),
          headers: { "Content-Type": "application/json" },
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        message: string;
        method: string;
      };
      expect(data.method).toBe("POST");
    });

    test("should handle custom headers", async () => {
      await startHttpServer();

      const response = await fetchwithRequestOptions(
        `http://localhost:${HTTP_PORT}/headers`,
        {
          headers: { "X-Custom-Header": "test-value" },
        },
      );

      const data = (await response.json()) as {
        headers: Record<string, string>;
      };
      expect(data.headers["x-custom-header"]).toBe("test-value");
    });

    test("should handle error responses", async () => {
      await startHttpServer();

      const response = await fetchwithRequestOptions(
        `http://localhost:${HTTP_PORT}/status/404`,
      );

      expect(response.status).toBe(404);
      expect(response.ok).toBe(false);
    });
  });

  describe("Request options integration", () => {
    test("should merge extra body properties", async () => {
      await startHttpServer();

      const response = await fetchwithRequestOptions(
        `http://localhost:${HTTP_PORT}/body`,
        {
          method: "POST",
          body: JSON.stringify({ original: "data" }),
          headers: { "Content-Type": "application/json" },
        },
        {
          extraBodyProperties: { extra: "property" },
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        body: string;
        headers: Record<string, string>;
      };
      const body = JSON.parse(data.body);
      expect(body).toEqual({ original: "data", extra: "property" });
    });

    test("should handle RequestOptions headers", async () => {
      await startHttpServer();

      const response = await fetchwithRequestOptions(
        `http://localhost:${HTTP_PORT}/headers`,
        {},
        {
          headers: { "X-Request-Options-Header": "from-request-options" },
        },
      );

      const data = (await response.json()) as {
        headers: Record<string, string>;
      };
      expect(data.headers["x-request-options-header"]).toBe(
        "from-request-options",
      );
    });

    test("should merge headers from init and requestOptions", async () => {
      await startHttpServer();

      const response = await fetchwithRequestOptions(
        `http://localhost:${HTTP_PORT}/headers`,
        {
          headers: { "X-Init-Header": "from-init" },
        },
        {
          headers: { "X-Request-Options-Header": "from-request-options" },
        },
      );

      const data = (await response.json()) as {
        headers: Record<string, string>;
      };
      expect(data.headers["x-init-header"]).toBe("from-init");
      expect(data.headers["x-request-options-header"]).toBe(
        "from-request-options",
      );
    });
  });

  describe("Certificate handling - Enterprise scenarios", () => {
    test("should REJECT self-signed certificates when SSL verification is enabled", async () => {
      const tempDir = createTempDir();
      const serverCerts = await generateCertificate(tempDir, "server", {
        cn: "localhost",
        san: ["localhost", "127.0.0.1"],
        org: "Test",
      });

      await startHttpsServer(serverCerts.certPath, serverCerts.keyPath);

      // This simulates the customer's "unable to get local issuer certificate" error
      await expect(
        fetchwithRequestOptions(
          `https://localhost:${HTTPS_PORT}/secure`,
          {},
          { verifySsl: true }, // No custom CA provided
        ),
      ).rejects.toThrow(); // Should fail with certificate error
    });

    test("should ACCEPT self-signed certificates when SSL verification is disabled", async () => {
      const tempDir = createTempDir();
      const serverCerts = await generateCertificate(tempDir, "server", {
        cn: "localhost",
        san: ["localhost", "127.0.0.1"],
        org: "Test",
      });

      await startHttpsServer(serverCerts.certPath, serverCerts.keyPath);

      const response = await fetchwithRequestOptions(
        `https://localhost:${HTTPS_PORT}/secure`,
        {},
        { verifySsl: false },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        message: string;
        secure: boolean;
      };
      expect(data.secure).toBe(true);
    });

    test("should ACCEPT self-signed certificates with custom CA bundle", async () => {
      const tempDir = createTempDir();
      const serverCerts = await generateCertificate(tempDir, "server", {
        cn: "localhost",
        san: ["localhost", "127.0.0.1"],
        org: "Test",
      });

      await startHttpsServer(serverCerts.certPath, serverCerts.keyPath);

      const response = await fetchwithRequestOptions(
        `https://localhost:${HTTPS_PORT}/secure`,
        {},
        {
          caBundlePath: serverCerts.caCertPath, // Our self-signed cert as CA
          verifySsl: true,
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        message: string;
        secure: boolean;
      };
      expect(data.secure).toBe(true);
    });

    test("should REJECT certificates when provided WRONG CA bundle", async () => {
      const tempDir = createTempDir();
      const serverCerts = await generateCertificate(tempDir, "server", {
        cn: "localhost",
        san: ["localhost", "127.0.0.1"],
        org: "Test",
      });

      // Generate a different certificate as the "wrong" CA
      const wrongCaCerts = await generateCertificate(tempDir, "wrong-ca", {
        cn: "wrong-ca",
        san: ["wrong-ca"],
        org: "Wrong CA",
      });

      await startHttpsServer(serverCerts.certPath, serverCerts.keyPath);

      // This should fail because the wrong CA can't validate our server certificate
      await expect(
        fetchwithRequestOptions(
          `https://localhost:${HTTPS_PORT}/secure`,
          {},
          {
            caBundlePath: wrongCaCerts.caCertPath,
            verifySsl: true,
          },
        ),
      ).rejects.toThrow(); // Should fail with certificate validation error
    });

    test("should REJECT certificates when CA bundle file is corrupted", async () => {
      const tempDir = createTempDir();
      const serverCerts = await generateCertificate(tempDir, "server", {
        cn: "localhost",
        san: ["localhost", "127.0.0.1"],
        org: "Test",
      });

      // Create a corrupted/invalid certificate file
      const corruptedCaPath = path.join(tempDir, "corrupted-ca.pem");
      const corruptedContent = `-----BEGIN CERTIFICATE-----
This is not a valid certificate content
Just some random text that looks like a cert
-----END CERTIFICATE-----`;

      fs.writeFileSync(corruptedCaPath, corruptedContent);

      await startHttpsServer(serverCerts.certPath, serverCerts.keyPath);

      // This should fail because the corrupted CA file can't be parsed
      await expect(
        fetchwithRequestOptions(
          `https://localhost:${HTTPS_PORT}/secure`,
          {},
          {
            caBundlePath: corruptedCaPath,
            verifySsl: true,
          },
        ),
      ).rejects.toThrow(); // Should fail with certificate parsing or validation error
    });

    test("should REJECT certificates when CA bundle file does not exist", async () => {
      const tempDir = createTempDir();
      const serverCerts = await generateCertificate(tempDir, "server", {
        cn: "localhost",
        san: ["localhost", "127.0.0.1"],
        org: "Test",
      });

      const nonExistentCaPath = path.join(tempDir, "does-not-exist.pem");

      await startHttpsServer(serverCerts.certPath, serverCerts.keyPath);

      // This should handle the missing file gracefully but still fail cert validation
      await expect(
        fetchwithRequestOptions(
          `https://localhost:${HTTPS_PORT}/secure`,
          {},
          {
            caBundlePath: nonExistentCaPath,
            verifySsl: true,
          },
        ),
      ).rejects.toThrow(); // Should fail with certificate validation error
    });
  });

  describe("Error handling", () => {
    test("should handle network errors gracefully", async () => {
      // Try to connect to a non-existent server
      await expect(
        fetchwithRequestOptions("http://localhost:9999/nonexistent"),
      ).rejects.toThrow();
    });

    test("should handle malformed URLs", async () => {
      await expect(
        fetchwithRequestOptions("not-a-valid-url"),
      ).rejects.toThrow();
    });
  });
});
