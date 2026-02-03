import {
  streamJSON,
  streamResponse,
  streamSse,
  toAsyncIterable,
} from "./stream.js";

import rawPatchedFetch from "./node-fetch-patch.js";
import { assertLocalhostRequest } from "./networkGuard.js";

import { fetchwithRequestOptions } from "./fetch.js";

const patchedFetch = (input: RequestInfo | URL, init?: RequestInit) => {
  assertLocalhostRequest(input, "patchedFetch");
  return rawPatchedFetch(input, init);
};

export {
  fetchwithRequestOptions,
  patchedFetch,
  streamJSON,
  streamResponse,
  streamSse,
  toAsyncIterable,
};

export { assertLocalhostRequest, assertLocalhostUrl } from "./networkGuard.js";
