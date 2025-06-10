import { TextDecoder, TextEncoder } from "util";

import fetch, { Request, Response } from "node-fetch";
import { beforeAll } from "vitest";

// if (process.env.DEBUG === "jest") {
//   jest.setTimeout(5 * 60 * 1000);
// }

beforeAll(() => {
  // @ts-ignore
  globalThis.fetch = fetch;
  // @ts-ignore
  globalThis.Request = Request;
  // @ts-ignore
  globalThis.Response = Response;
  globalThis.TextEncoder = TextEncoder;
  // @ts-ignore
  globalThis.TextDecoder = TextDecoder;
});

// https://github.com/mswjs/msw/issues/1576#issuecomment-1482643055

// TODO - currently causing tests to fail because sqlite is still running for some reason
// const clearTestDirectory = () => {
//   if (fs.existsSync(process.env.CONTINUE_GLOBAL_DIR!)) {
//     fs.rmSync(process.env.CONTINUE_GLOBAL_DIR!, { recursive: true });
//   }
// };

// globalThis.beforeAll(clearTestDirectory);
// globalThis.afterAll(clearTestDirectory);
