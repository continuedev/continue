import { describe, expect, test } from "vitest";
import { getTlsErrorHint } from "./tlsErrors.js";

const withCode = (code: string, message = "boom") =>
  Object.assign(new Error(message), { code });

describe("getTlsErrorHint", () => {
  test.each([
    "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
  ])("explains an untrusted certificate (%s)", (code) => {
    const hint = getTlsErrorHint(withCode(code));
    expect(hint).toContain("useSystemCa");
    expect(hint).toContain("caBundlePath");
  });

  test("finds the cause behind a wrapped 'Connection error.'", () => {
    const wrapped = new Error("Connection error.", {
      cause: withCode("UNABLE_TO_GET_ISSUER_CERT_LOCALLY"),
    });
    expect(getTlsErrorHint(wrapped)).toContain("isn't trusted");
  });

  test("recognises the message form", () => {
    expect(
      getTlsErrorHint(new Error("unable to get local issuer certificate")),
    ).toContain("isn't trusted");
  });

  test("expired, hostname mismatch and proxy auth", () => {
    expect(getTlsErrorHint(withCode("CERT_HAS_EXPIRED"))).toContain("expired");
    expect(getTlsErrorHint(withCode("ERR_TLS_CERT_ALTNAME_INVALID"))).toContain(
      "doesn't match",
    );
    expect(
      getTlsErrorHint(
        new Error("Proxy responded with 407 Proxy Authentication Required"),
      ),
    ).toContain("407");
  });

  test("returns undefined for unrelated errors and non-errors", () => {
    expect(getTlsErrorHint(new Error("rate limited"))).toBeUndefined();
    expect(getTlsErrorHint(undefined)).toBeUndefined();
    expect(getTlsErrorHint("string")).toBeUndefined();
  });

  test("does not loop on circular causes", () => {
    const a: any = new Error("a");
    a.cause = a;
    expect(getTlsErrorHint(a)).toBeUndefined();
  });
});
