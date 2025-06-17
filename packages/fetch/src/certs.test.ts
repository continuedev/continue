import * as fs from "node:fs";
import { beforeEach, expect, test, vi } from "vitest";
import { getCertificateContent } from "./certs.js";

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
