import * as os from "os";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { pathToUri, slugToUri, uriToPath, uriToSlug } from "./uriUtils.js";

describe("uriUtils", () => {
    describe("pathToUri", () => {
        it("should convert absolute paths to file:// URIs", () => {
            const absolutePath = "/home/user/.continue/config.yaml";
            const uri = pathToUri(absolutePath);
            expect(uri).toBe(`file://${absolutePath}`);
        });

        it("should resolve relative paths to absolute paths", () => {
            const relativePath = "./config.yaml";
            const uri = pathToUri(relativePath);

            // Should be absolute, not relative
            expect(uri).toMatch(/^file:\/\//);
            expect(uri).not.toContain("./");

            // Should contain the current working directory
            const expectedPath = path.resolve(relativePath);
            expect(uri).toBe(`file://${expectedPath}`);
        });

        it("should expand tilde (~) to home directory", () => {
            const tildePath = "~/.continue/config.yaml";
            const uri = pathToUri(tildePath);

            const expectedPath = path.join(os.homedir(), ".continue/config.yaml");
            expect(uri).toBe(`file://${expectedPath}`);
        }); it("should handle paths starting with ../", () => {
            const parentPath = "../config.yaml";
            const uri = pathToUri(parentPath);

            // Should be absolute
            expect(uri).toMatch(/^file:\/\//);
            expect(uri).not.toContain("../");

            const expectedPath = path.resolve(parentPath);
            expect(uri).toBe(`file://${expectedPath}`);
        });

        it("should handle Windows absolute paths", () => {
            // This test will pass on any OS since we're just checking the logic
            const windowsPath = "C:\\Users\\user\\.continue\\config.yaml";
            const uri = pathToUri(windowsPath);

            expect(uri).toMatch(/^file:\/\//);
        });
    });

    describe("slugToUri", () => {
        it("should convert assistant slug to slug:// URI", () => {
            const slug = "continuedev/default-agent";
            const uri = slugToUri(slug);
            expect(uri).toBe("slug://continuedev/default-agent");
        });
    });

    describe("uriToPath", () => {
        it("should extract path from file:// URI", () => {
            const uri = "file:///home/user/.continue/config.yaml";
            const extractedPath = uriToPath(uri);
            expect(extractedPath).toBe("/home/user/.continue/config.yaml");
        });

        it("should return null for non-file:// URIs", () => {
            const uri = "slug://continuedev/default-agent";
            const extractedPath = uriToPath(uri);
            expect(extractedPath).toBeNull();
        });

        it("should return null for invalid URIs", () => {
            const uri = "not-a-uri";
            const extractedPath = uriToPath(uri);
            expect(extractedPath).toBeNull();
        });
    });

    describe("uriToSlug", () => {
        it("should extract slug from slug:// URI", () => {
            const uri = "slug://continuedev/default-agent";
            const extractedSlug = uriToSlug(uri);
            expect(extractedSlug).toBe("continuedev/default-agent");
        });

        it("should return null for non-slug:// URIs", () => {
            const uri = "file:///home/user/.continue/config.yaml";
            const extractedSlug = uriToSlug(uri);
            expect(extractedSlug).toBeNull();
        });

        it("should return null for invalid URIs", () => {
            const uri = "not-a-uri";
            const extractedSlug = uriToSlug(uri);
            expect(extractedSlug).toBeNull();
        });
    });

    describe("round-trip conversions", () => {
        it("should correctly round-trip absolute file paths", () => {
            const originalPath = "/home/user/.continue/config.yaml";
            const uri = pathToUri(originalPath);
            const extractedPath = uriToPath(uri);
            expect(extractedPath).toBe(originalPath);
        });

        it("should correctly round-trip relative file paths (after resolution)", () => {
            const relativePath = "./config.yaml";
            const uri = pathToUri(relativePath);
            const extractedPath = uriToPath(uri);

            // The extracted path should be absolute, not the original relative path
            expect(extractedPath).toBe(path.resolve(relativePath));
        });

        it("should correctly round-trip tilde paths (after expansion)", () => {
            const tildePath = "~/.continue/config.yaml";
            const uri = pathToUri(tildePath);
            const extractedPath = uriToPath(uri);

            // The extracted path should be the expanded home directory path
            const expectedPath = path.join(os.homedir(), ".continue/config.yaml");
            expect(extractedPath).toBe(expectedPath);
        });

        it("should correctly round-trip assistant slugs", () => {
            const originalSlug = "continuedev/default-agent";
            const uri = slugToUri(originalSlug);
            const extractedSlug = uriToSlug(uri);
            expect(extractedSlug).toBe(originalSlug);
        });
    });
});
