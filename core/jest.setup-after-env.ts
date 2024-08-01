// https://github.com/mswjs/msw/issues/1576#issuecomment-1482643055
import { TextEncoder, TextDecoder } from "util";
import fetch, { Request, Response } from "node-fetch";
import { jest } from "@jest/globals";

if (process.env.DEBUG === "jest") {
  jest.setTimeout(5 * 60 * 1000);
}

const globalThis = global as any;

globalThis.fetch = fetch;
globalThis.Request = Request;
globalThis.Response = Response;
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;
