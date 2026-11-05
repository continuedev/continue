import { describe, expect, it } from "vitest";
import {
  isNonPublicAddress,
  isNonPublicHostname,
  resolvesToNonPublic,
} from "./networkAddress";

describe("isNonPublicAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "[::1]",
  ])("%s is non-public", (ip) => expect(isNonPublicAddress(ip)).toBe(true));

  it.each([
    "8.8.8.8",
    "172.32.0.1",
    "100.128.0.1",
    "2606:4700::1111",
    "::ffff:1.1.1.1",
  ])("%s is public", (ip) => expect(isNonPublicAddress(ip)).toBe(false));
});

describe("isNonPublicHostname", () => {
  it.each([
    "localhost",
    "api.localhost",
    "printer.local",
    "metadata.google.internal",
    "nas.home.arpa",
    "127.0.0.1",
    "[::1]",
  ])("%s is non-public", (h) => expect(isNonPublicHostname(h)).toBe(true));
  it.each(["example.com", "localhost.example.com", "8.8.8.8"])(
    "%s is not known to be non-public",
    (h) => expect(isNonPublicHostname(h)).toBe(false),
  );
});

describe("resolvesToNonPublic", () => {
  it("catches a public-looking name that resolves to a private address", async () => {
    expect(
      await resolvesToNonPublic("evil.example", async () => ["10.0.0.5"]),
    ).toBe(true);
  });
  it("passes a name that resolves only to public addresses", async () => {
    expect(
      await resolvesToNonPublic("example.com", async () => ["93.184.215.14"]),
    ).toBe(false);
  });
  it("does not treat an unresolvable name as non-public", async () => {
    expect(
      await resolvesToNonPublic("nope.invalid", async () => {
        throw new Error("ENOTFOUND");
      }),
    ).toBe(false);
  });
});
