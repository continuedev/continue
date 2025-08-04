import * as fs from "node:fs";
import { beforeEach, expect, test, vi } from "vitest";
import { CertsCache, getCertificateContent } from "./certs.js";

// Mock fs module
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

const mockReadFileSync = vi.mocked(fs.readFileSync);

beforeEach(() => {
  vi.clearAllMocks();
});

test("getCertificateContent should decode base64 data URI correctly", () => {
  const testCert =
    "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----";
  const base64Data = Buffer.from(testCert, "utf8").toString("base64");
  const dataUri = `data:application/x-pem-file;base64,${base64Data}`;

  const result = getCertificateContent(dataUri);

  expect(result).toBe(testCert);
});

test("getCertificateContent should decode URL-encoded data URI correctly", () => {
  const testCert =
    "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----";
  const encodedData = encodeURIComponent(testCert);
  const dataUri = `data:text/plain,${encodedData}`;

  const result = getCertificateContent(dataUri);

  expect(result).toBe(testCert);
});

test("getCertificateContent should handle plain text data URI correctly", () => {
  const testCert = "simple-cert-content";
  const dataUri = `data:text/plain,${testCert}`;

  const result = getCertificateContent(dataUri);

  expect(result).toBe(testCert);
});

test("getCertificateContent should read file when input is a file path", () => {
  const filePath = "/path/to/cert.pem";
  const expectedContent =
    "-----BEGIN CERTIFICATE-----\nfile content\n-----END CERTIFICATE-----";

  mockReadFileSync.mockReturnValue(expectedContent);

  const result = getCertificateContent(filePath);

  expect(mockReadFileSync).toHaveBeenCalledWith(filePath, "utf8");
  expect(result).toBe(expectedContent);
});

test("getCertificateContent should handle data URI with different media types", () => {
  const testData = "certificate-data";
  const base64Data = Buffer.from(testData, "utf8").toString("base64");
  const dataUri = `data:application/x-x509-ca-cert;base64,${base64Data}`;

  const result = getCertificateContent(dataUri);

  expect(result).toBe(testData);
});

test("getCertificateContent should handle data URI without media type", () => {
  const testData = "simple-data";
  const base64Data = Buffer.from(testData, "utf8").toString("base64");
  const dataUri = `data:;base64,${base64Data}`;

  const result = getCertificateContent(dataUri);

  expect(result).toBe(testData);
});

test("getCertificateContent should handle data URI without media type or encoding", () => {
  const testData = "simple-data";
  const base64Data = Buffer.from(testData, "utf8").toString("base64");
  const dataUri = `data:;base64,${base64Data}`;

  const result = getCertificateContent(dataUri);

  expect(result).toBe(testData);
});

test("getCertificateContent should handle relative file paths", () => {
  const filePath = "./certs/ca.pem";
  const expectedContent = "certificate from relative path";

  mockReadFileSync.mockReturnValue(expectedContent);

  const result = getCertificateContent(filePath);

  expect(mockReadFileSync).toHaveBeenCalledWith(filePath, "utf8");
  expect(result).toBe(expectedContent);
});

test("getCertificateContent should handle data URI with special characters in URL encoding", () => {
  const testCert = "cert with spaces and special chars: !@#$%";
  const encodedData = encodeURIComponent(testCert);
  const dataUri = `data:text/plain,${encodedData}`;

  const result = getCertificateContent(dataUri);

  expect(result).toBe(testCert);
});

test("CertsCache.getCachedCustomCert should cache and return certificate content", async () => {
  const certsCache = CertsCache.getInstance();
  const filePath = "/path/to/custom/cert.pem";
  const expectedContent = "custom cert content";

  mockReadFileSync.mockReturnValue(expectedContent);

  const cert1 = await certsCache.getCachedCustomCert(filePath);
  expect(cert1).toBe(expectedContent);
  expect(mockReadFileSync).toHaveBeenCalledTimes(1);
  expect(mockReadFileSync).toHaveBeenCalledWith(filePath, "utf8");

  // Call again to check if it's cached
  const cert2 = await certsCache.getCachedCustomCert(filePath);
  expect(cert2).toBe(expectedContent);
  // readFileSync should not be called again
  expect(mockReadFileSync).toHaveBeenCalledTimes(1);
});

test("CertsCache.getAllCachedCustomCerts should return all cached custom certs", async () => {
  const certsCache = CertsCache.getInstance();
  const filePaths = ["/path/to/cert1.pem", "/path/to/cert2.pem"];
  const expectedContent1 = "content of cert1";
  const expectedContent2 = "content of cert2";

  mockReadFileSync.mockReturnValueOnce(expectedContent1);
  mockReadFileSync.mockReturnValueOnce(expectedContent2);

  const certs = await certsCache.getAllCachedCustomCerts(filePaths);
  expect(certs).toEqual([expectedContent1, expectedContent2]);
  expect(mockReadFileSync).toHaveBeenCalledTimes(2);
});

test("CertsCache.getCa should return combined CA when caBundlePath is provided", async () => {
  const certsCache = CertsCache.getInstance();
  const fixedCa = ["fixed CA cert"];
  const customCertPath = "/path/to/custom/cert.pem";
  const customCertContent = "custom cert content";

  // Directly set _fixedCa to avoid initializing it with real data
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  certsCache._fixedCa = fixedCa;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  certsCache._initialized = true;
  mockReadFileSync.mockReturnValue(customCertContent);

  const ca = await certsCache.getCa(customCertPath);
  expect(ca).toEqual([...fixedCa, customCertContent]);
});

test("CertsCache.clear should clear custom certs and reset initialized flag", () => {
  const certsCache = CertsCache.getInstance();
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  certsCache._customCerts.set("key", "value");
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  certsCache._initialized = true;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  certsCache._fixedCa = ["test"];

  certsCache.clear();

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  expect(certsCache._customCerts.size).toBe(0);
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  expect(certsCache._initialized).toBe(false);
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  expect(certsCache._fixedCa).toEqual([]);
});
