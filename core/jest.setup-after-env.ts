// https://github.com/mswjs/msw/issues/1576#issuecomment-1482643055
import { TextDecoder, TextEncoder } from "util";

import { jest } from "@jest/globals";
import fetch, { Request, Response } from "node-fetch";

if (process.env.DEBUG === "jest") {
  jest.setTimeout(5 * 60 * 1000);
}

const globalThis = global as any;

globalThis.fetch = fetch;
globalThis.Request = Request;
globalThis.Response = Response;
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

// Trying to delete this when for some reason SQLite is still in use causes tests to fail
// globalThis.beforeAll(() => {
//   // We can ignore TS warnings here since we set this explicitly in `./jest.global-setup.ts`
//   if (fs.existsSync(process.env.CONTINUE_GLOBAL_DIR!)) {
//     fs.rmSync(process.env.CONTINUE_GLOBAL_DIR!, { recursive: true });
//   }
// });

// globalThis.afterAll(() => {
//   // We can ignore TS warnings here since we set this explicitly in `./jest.global-setup.ts`
//   if (fs.existsSync(process.env.CONTINUE_GLOBAL_DIR!)) {
//     fs.rmSync(process.env.CONTINUE_GLOBAL_DIR!, { recursive: true });
//   }
// });
