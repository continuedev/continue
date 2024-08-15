// https://github.com/mswjs/msw/issues/1576#issuecomment-1482643055
import { TextEncoder, TextDecoder } from "util";
import fetch, { Request, Response } from "node-fetch";
import { jest } from "@jest/globals";
import fs from "fs";

if (process.env.DEBUG === "jest") {
  jest.setTimeout(5 * 60 * 1000);
}

const globalThis = global as any;

globalThis.fetch = fetch;
globalThis.Request = Request;
globalThis.Response = Response;
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

global.beforeAll(() => {
  // We can ignore TS warnings here since we set this explicitly in `./jest.global-setup.ts`
  if (fs.existsSync(process.env.CONTINUE_GLOBAL_DIR!)) {
    fs.rmSync(process.env.CONTINUE_GLOBAL_DIR!, { recursive: true });
  }
});

global.afterAll(() => {
  // We can ignore TS warnings here since we set this explicitly in `./jest.global-setup.ts`
  if (fs.existsSync(process.env.CONTINUE_GLOBAL_DIR!)) {
    fs.rmSync(process.env.CONTINUE_GLOBAL_DIR!, { recursive: true });
  }
});
