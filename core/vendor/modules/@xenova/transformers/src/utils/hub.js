/**
 * @file Utility functions to interact with the Hugging Face Hub (https://huggingface.co/models)
 *
 * @module utils/hub
 */

import fs from "fs";
import path from "path";
import stream from "stream/web";

import { env } from "../env.js";
import { dispatchCallback } from "./core.js";

if (!globalThis.ReadableStream) {
  // @ts-ignore
  globalThis.ReadableStream = stream.ReadableStream; // ReadableStream is not a global with Node 16
}

/**
 * @typedef {Object} PretrainedOptions Options for loading a pretrained model.
 * @property {boolean?} [quantized=true] Whether to load the 8-bit quantized version of the model (only applicable when loading model files).
 * @property {function} [progress_callback=null] If specified, this function will be called during model construction, to provide the user with progress updates.
 * @property {Object} [config=null] Configuration for the model to use instead of an automatically loaded configuration. Configuration can be automatically loaded when:
 * - The model is a model provided by the library (loaded with the *model id* string of a pretrained model).
 * - The model is loaded by supplying a local directory as `pretrained_model_name_or_path` and a configuration JSON file named *config.json* is found in the directory.
 * @property {string} [cache_dir=null] Path to a directory in which a downloaded pretrained model configuration should be cached if the standard cache should not be used.
 * @property {boolean} [local_files_only=false] Whether or not to only look at local files (e.g., not try downloading the model).
 * @property {string} [revision='main'] The specific model version to use. It can be a branch name, a tag name, or a commit id,
 * since we use a git-based system for storing models and other artifacts on huggingface.co, so `revision` can be any identifier allowed by git.
 * NOTE: This setting is ignored for local requests.
 * @property {string} [model_file_name=null] If specified, load the model with this name (excluding the .onnx suffix). Currently only valid for encoder- or decoder-only models.
 */

class FileResponse {
  /**
   * Mapping from file extensions to MIME types.
   */
  _CONTENT_TYPE_MAP = {
    txt: "text/plain",
    html: "text/html",
    css: "text/css",
    js: "text/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
  };
  /**
   * Creates a new `FileResponse` object.
   * @param {string|URL} filePath
   */
  constructor(filePath) {
    this.filePath = filePath;
    this.headers = new Headers();

    this.exists = fs.existsSync(filePath);
    if (this.exists) {
      this.status = 200;
      this.statusText = "OK";

      let stats = fs.statSync(filePath);
      this.headers.set("content-length", stats.size.toString());

      this.updateContentType();

      let self = this;
      this.body = new ReadableStream({
        start(controller) {
          self.arrayBuffer().then((buffer) => {
            controller.enqueue(new Uint8Array(buffer));
            controller.close();
          });
        },
      });
    } else {
      this.status = 404;
      this.statusText = "Not Found";
      this.body = null;
    }
  }

  /**
   * Updates the 'content-type' header property of the response based on the extension of
   * the file specified by the filePath property of the current object.
   * @returns {void}
   */
  updateContentType() {
    // Set content-type header based on file extension
    const extension = this.filePath.toString().split(".").pop().toLowerCase();
    this.headers.set(
      "content-type",
      this._CONTENT_TYPE_MAP[extension] ?? "application/octet-stream",
    );
  }

  /**
   * Clone the current FileResponse object.
   * @returns {FileResponse} A new FileResponse object with the same properties as the current object.
   */
  clone() {
    let response = new FileResponse(this.filePath);
    response.exists = this.exists;
    response.status = this.status;
    response.statusText = this.statusText;
    response.headers = new Headers(this.headers);
    return response;
  }

  /**
   * Reads the contents of the file specified by the filePath property and returns a Promise that
   * resolves with an ArrayBuffer containing the file's contents.
   * @returns {Promise<ArrayBuffer>} A Promise that resolves with an ArrayBuffer containing the file's contents.
   * @throws {Error} If the file cannot be read.
   */
  async arrayBuffer() {
    const data = await fs.promises.readFile(this.filePath);
    return data.buffer;
  }

  /**
   * Reads the contents of the file specified by the filePath property and returns a Promise that
   * resolves with a Blob containing the file's contents.
   * @returns {Promise<Blob>} A Promise that resolves with a Blob containing the file's contents.
   * @throws {Error} If the file cannot be read.
   */
  async blob() {
    const data = await fs.promises.readFile(this.filePath);
    return new Blob([data], { type: this.headers.get("content-type") });
  }

  /**
   * Reads the contents of the file specified by the filePath property and returns a Promise that
   * resolves with a string containing the file's contents.
   * @returns {Promise<string>} A Promise that resolves with a string containing the file's contents.
   * @throws {Error} If the file cannot be read.
   */
  async text() {
    const data = await fs.promises.readFile(this.filePath, "utf8");
    return data;
  }

  /**
   * Reads the contents of the file specified by the filePath property and returns a Promise that
   * resolves with a parsed JavaScript object containing the file's contents.
   *
   * @returns {Promise<Object>} A Promise that resolves with a parsed JavaScript object containing the file's contents.
   * @throws {Error} If the file cannot be read.
   */
  async json() {
    return JSON.parse(await this.text());
  }
}

/**
 * Determines whether the given string is a valid HTTP or HTTPS URL.
 * @param {string|URL} string The string to test for validity as an HTTP or HTTPS URL.
 * @param {string[]} [validHosts=null] A list of valid hostnames. If specified, the URL's hostname must be in this list.
 * @returns {boolean} True if the string is a valid HTTP or HTTPS URL, false otherwise.
 */
function isValidHttpUrl(string, validHosts = null) {
  // https://stackoverflow.com/a/43467144
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  if (validHosts && !validHosts.includes(url.hostname)) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

/**
 * Helper function to get a file, using either the Fetch API or FileSystem API.
 *
 * @param {URL|string} urlOrPath The URL/path of the file to get.
 * @returns {Promise<FileResponse|Response>} A promise that resolves to a FileResponse object (if the file is retrieved using the FileSystem API), or a Response object (if the file is retrieved using the Fetch API).
 */
export async function getFile(urlOrPath) {
  if (env.useFS && !isValidHttpUrl(urlOrPath)) {
    return new FileResponse(urlOrPath);
  } else if (
    typeof process !== "undefined" &&
    process?.release?.name === "node"
  ) {
    const IS_CI = !!process.env?.TESTING_REMOTELY;
    const version = env.version;

    const headers = new Headers();
    headers.set("User-Agent", `transformers.js/${version}; is_ci/${IS_CI};`);

    // Check whether we are making a request to the Hugging Face Hub.
    const isHFURL = isValidHttpUrl(urlOrPath, ["huggingface.co", "hf.co"]);
    if (isHFURL) {
      // If an access token is present in the environment variables,
      // we add it to the request headers.
      // NOTE: We keep `HF_ACCESS_TOKEN` for backwards compatibility (as a fallback).
      const token = process.env?.HF_TOKEN ?? process.env?.HF_ACCESS_TOKEN;
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }
    return fetch(urlOrPath, { headers });
  } else {
    // Running in a browser-environment, so we use default headers
    // NOTE: We do not allow passing authorization headers in the browser,
    // since this would require exposing the token to the client.
    return fetch(urlOrPath);
  }
}

const ERROR_MAPPING = {
  // 4xx errors (https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#client_error_responses)
  400: "Bad request error occurred while trying to load file",
  401: "Unauthorized access to file",
  403: "Forbidden access to file",
  404: "Could not locate file",
  408: "Request timeout error occurred while trying to load file",

  // 5xx errors (https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#server_error_responses)
  500: "Internal server error error occurred while trying to load file",
  502: "Bad gateway error occurred while trying to load file",
  503: "Service unavailable error occurred while trying to load file",
  504: "Gateway timeout error occurred while trying to load file",
};
/**
 * Helper method to handle fatal errors that occur while trying to load a file from the Hugging Face Hub.
 * @param {number} status The HTTP status code of the error.
 * @param {string} remoteURL The URL of the file that could not be loaded.
 * @param {boolean} fatal Whether to raise an error if the file could not be loaded.
 * @returns {null} Returns `null` if `fatal = true`.
 * @throws {Error} If `fatal = false`.
 */
function handleError(status, remoteURL, fatal) {
  if (!fatal) {
    // File was not loaded correctly, but it is optional.
    // TODO in future, cache the response?
    return null;
  }

  const message =
    ERROR_MAPPING[status] ??
    `Error (${status}) occurred while trying to load file`;
  throw Error(`${message}: "${remoteURL}".`);
}

class FileCache {
  /**
   * Instantiate a `FileCache` object.
   * @param {string} path
   */
  constructor(path) {
    this.path = path;
  }

  /**
   * Checks whether the given request is in the cache.
   * @param {string} request
   * @returns {Promise<FileResponse | undefined>}
   */
  async match(request) {
    let filePath = path.join(this.path, request);
    let file = new FileResponse(filePath);

    if (file.exists) {
      return file;
    } else {
      return undefined;
    }
  }

  /**
   * Adds the given response to the cache.
   * @param {string} request
   * @param {Response|FileResponse} response
   * @returns {Promise<void>}
   */
  async put(request, response) {
    const buffer = Buffer.from(await response.arrayBuffer());

    let outputPath = path.join(this.path, request);

    try {
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.promises.writeFile(outputPath, buffer);
    } catch (err) {
      console.warn("An error occurred while writing the file to cache:", err);
    }
  }

  // TODO add the rest?
  // addAll(requests: RequestInfo[]): Promise<void>;
  // delete(request: RequestInfo | URL, options?: CacheQueryOptions): Promise<boolean>;
  // keys(request?: RequestInfo | URL, options?: CacheQueryOptions): Promise<ReadonlyArray<Request>>;
  // match(request: RequestInfo | URL, options?: CacheQueryOptions): Promise<Response | undefined>;
  // matchAll(request?: RequestInfo | URL, options?: CacheQueryOptions): Promise<ReadonlyArray<Response>>;
}

/**
 *
 * @param {FileCache|Cache} cache The cache to search
 * @param {string[]} names The names of the item to search for
 * @returns {Promise<FileResponse|Response|undefined>} The item from the cache, or undefined if not found.
 */
async function tryCache(cache, ...names) {
  for (let name of names) {
    try {
      let result = await cache.match(name);
      if (result) return result;
    } catch (e) {
      continue;
    }
  }
  return undefined;
}

/**
 *
 * Retrieves a file from either a remote URL using the Fetch API or from the local file system using the FileSystem API.
 * If the filesystem is available and `env.useCache = true`, the file will be downloaded and cached.
 *
 * @param {string} path_or_repo_id This can be either:
 * - a string, the *model id* of a model repo on huggingface.co.
 * - a path to a *directory* potentially containing the file.
 * @param {string} filename The name of the file to locate in `path_or_repo`.
 * @param {boolean} [fatal=true] Whether to throw an error if the file is not found.
 * @param {PretrainedOptions} [options] An object containing optional parameters.
 *
 * @throws Will throw an error if the file is not found and `fatal` is true.
 * @returns {Promise} A Promise that resolves with the file content as a buffer.
 */
export async function getModelFile(
  path_or_repo_id,
  filename,
  fatal = true,
  options = {},
) {
  if (!env.allowLocalModels) {
    // User has disabled local models, so we just make sure other settings are correct.

    if (options.local_files_only) {
      throw Error(
        "Invalid configuration detected: local models are disabled (`env.allowLocalModels=false`) but you have requested to only use local models (`local_files_only=true`).",
      );
    } else if (!env.allowRemoteModels) {
      throw Error(
        "Invalid configuration detected: both local and remote models are disabled. Fix by setting `env.allowLocalModels` or `env.allowRemoteModels` to `true`.",
      );
    }
  }

  // Initiate file retrieval
  dispatchCallback(options.progress_callback, {
    status: "initiate",
    name: path_or_repo_id,
    file: filename,
  });

  // First, check if the a caching backend is available
  // If no caching mechanism available, will download the file every time
  let cache;
  if (!cache && env.useBrowserCache) {
    if (typeof caches === "undefined") {
      throw Error("Browser cache is not available in this environment.");
    }
    try {
      // In some cases, the browser cache may be visible, but not accessible due to security restrictions.
      // For example, when running an application in an iframe, if a user attempts to load the page in
      // incognito mode, the following error is thrown: `DOMException: Failed to execute 'open' on 'CacheStorage':
      // An attempt was made to break through the security policy of the user agent.`
      // So, instead of crashing, we just ignore the error and continue without using the cache.
      cache = await caches.open("transformers-cache");
    } catch (e) {
      console.warn("An error occurred while opening the browser cache:", e);
    }
  }

  if (!cache && env.useFSCache) {
    // TODO throw error if not available

    // If `cache_dir` is not specified, use the default cache directory
    cache = new FileCache(options.cache_dir ?? env.cacheDir);
  }

  if (!cache && env.useCustomCache) {
    // Allow the user to specify a custom cache system.
    if (!env.customCache) {
      throw Error(
        "`env.useCustomCache=true`, but `env.customCache` is not defined.",
      );
    }

    // Check that the required methods are defined:
    if (!env.customCache.match || !env.customCache.put) {
      throw new Error(
        "`env.customCache` must be an object which implements the `match` and `put` functions of the Web Cache API. " +
          "For more information, see https://developer.mozilla.org/en-US/docs/Web/API/Cache",
      );
    }
    cache = env.customCache;
  }

  const revision = options.revision ?? "main";

  let requestURL = pathJoin(path_or_repo_id, filename);
  let localPath = pathJoin(env.localModelPath, requestURL);

  let remoteURL = pathJoin(
    env.remoteHost,
    env.remotePathTemplate
      .replaceAll("{model}", path_or_repo_id)
      .replaceAll("{revision}", encodeURIComponent(revision)),
    filename,
  );

  // Choose cache key for filesystem cache
  // When using the main revision (default), we use the request URL as the cache key.
  // If a specific revision is requested, we account for this in the cache key.
  let fsCacheKey =
    revision === "main"
      ? requestURL
      : pathJoin(path_or_repo_id, revision, filename);

  /** @type {string} */
  let cacheKey;
  let proposedCacheKey = cache instanceof FileCache ? fsCacheKey : remoteURL;

  // Whether to cache the final response in the end.
  let toCacheResponse = false;

  /** @type {Response|FileResponse|undefined} */
  let response;

  if (cache) {
    // A caching system is available, so we try to get the file from it.
    //  1. We first try to get from cache using the local path. In some environments (like deno),
    //     non-URL cache keys are not allowed. In these cases, `response` will be undefined.
    //  2. If no response is found, we try to get from cache using the remote URL or file system cache.
    response = await tryCache(cache, localPath, proposedCacheKey);
  }

  const cacheHit = response !== undefined;

  if (response === undefined) {
    // Caching not available, or file is not cached, so we perform the request

    if (env.allowLocalModels) {
      // Accessing local models is enabled, so we try to get the file locally.
      // If request is a valid HTTP URL, we skip the local file check. Otherwise, we try to get the file locally.
      const isURL = isValidHttpUrl(requestURL);
      if (!isURL) {
        try {
          response = await getFile(localPath);
          cacheKey = localPath; // Update the cache key to be the local path
        } catch (e) {
          // Something went wrong while trying to get the file locally.
          // NOTE: error handling is done in the next step (since `response` will be undefined)
          console.warn(`Unable to load from local path "${localPath}": "${e}"`);
        }
      } else if (options.local_files_only) {
        throw new Error(
          `\`local_files_only=true\`, but attempted to load a remote file from: ${requestURL}.`,
        );
      } else if (!env.allowRemoteModels) {
        throw new Error(
          `\`env.allowRemoteModels=false\`, but attempted to load a remote file from: ${requestURL}.`,
        );
      }
    }

    if (response === undefined || response.status === 404) {
      // File not found locally. This means either:
      // - The user has disabled local file access (`env.allowLocalModels=false`)
      // - the path is a valid HTTP url (`response === undefined`)
      // - the path is not a valid HTTP url and the file is not present on the file system or local server (`response.status === 404`)

      if (options.local_files_only || !env.allowRemoteModels) {
        // User requested local files only, but the file is not found locally.
        if (fatal) {
          throw Error(
            `\`local_files_only=true\` or \`env.allowRemoteModels=false\` and file was not found locally at "${localPath}".`,
          );
        } else {
          // File not found, but this file is optional.
          // TODO in future, cache the response?
          return null;
        }
      }

      // File not found locally, so we try to download it from the remote server
      response = await getFile(remoteURL);

      if (response.status !== 200) {
        return handleError(response.status, remoteURL, fatal);
      }

      // Success! We use the proposed cache key from earlier
      cacheKey = proposedCacheKey;
    }

    // Only cache the response if:
    toCacheResponse =
      cache && // 1. A caching system is available
      typeof Response !== "undefined" && // 2. `Response` is defined (i.e., we are in a browser-like environment)
      response instanceof Response && // 3. result is a `Response` object (i.e., not a `FileResponse`)
      response.status === 200; // 4. request was successful (status code 200)
  }

  // Start downloading
  dispatchCallback(options.progress_callback, {
    status: "download",
    name: path_or_repo_id,
    file: filename,
  });

  const progressInfo = {
    status: "progress",
    name: path_or_repo_id,
    file: filename,
  };

  /** @type {Uint8Array} */
  let buffer;

  if (!options.progress_callback) {
    // If no progress callback is specified, we can use the `.arrayBuffer()`
    // method to read the response.
    buffer = new Uint8Array(await response.arrayBuffer());
  } else if (
    cacheHit && // The item is being read from the cache
    typeof navigator !== "undefined" &&
    /firefox/i.test(navigator.userAgent) // We are in Firefox
  ) {
    // Due to bug in Firefox, we cannot display progress when loading from cache.
    // Fortunately, since this should be instantaneous, this should not impact users too much.
    buffer = new Uint8Array(await response.arrayBuffer());

    // For completeness, we still fire the final progress callback
    dispatchCallback(options.progress_callback, {
      ...progressInfo,
      progress: 100,
      loaded: buffer.length,
      total: buffer.length,
    });
  } else {
    buffer = await readResponse(response, (data) => {
      dispatchCallback(options.progress_callback, {
        ...progressInfo,
        ...data,
      });
    });
  }

  if (
    // Only cache web responses
    // i.e., do not cache FileResponses (prevents duplication)
    toCacheResponse &&
    cacheKey &&
    // Check again whether request is in cache. If not, we add the response to the cache
    (await cache.match(cacheKey)) === undefined
  ) {
    // NOTE: We use `new Response(buffer, ...)` instead of `response.clone()` to handle LFS files
    await cache
      .put(
        cacheKey,
        new Response(buffer, {
          headers: response.headers,
        }),
      )
      .catch((err) => {
        // Do not crash if unable to add to cache (e.g., QuotaExceededError).
        // Rather, log a warning and proceed with execution.
        console.warn(`Unable to add response to browser cache: ${err}.`);
      });
  }

  dispatchCallback(options.progress_callback, {
    status: "done",
    name: path_or_repo_id,
    file: filename,
  });

  return buffer;
}

/**
 * Fetches a JSON file from a given path and file name.
 *
 * @param {string} modelPath The path to the directory containing the file.
 * @param {string} fileName The name of the file to fetch.
 * @param {boolean} [fatal=true] Whether to throw an error if the file is not found.
 * @param {PretrainedOptions} [options] An object containing optional parameters.
 * @returns {Promise<Object>} The JSON data parsed into a JavaScript object.
 * @throws Will throw an error if the file is not found and `fatal` is true.
 */
export async function getModelJSON(
  modelPath,
  fileName,
  fatal = true,
  options = {},
) {
  let buffer = await getModelFile(modelPath, fileName, fatal, options);
  if (buffer === null) {
    // Return empty object
    return {};
  }

  let decoder = new TextDecoder("utf-8");
  let jsonData = decoder.decode(buffer);

  return JSON.parse(jsonData);
}

/**
 * Read and track progress when reading a Response object
 *
 * @param {any} response The Response object to read
 * @param {function} progress_callback The function to call with progress updates
 * @returns {Promise<Uint8Array>} A Promise that resolves with the Uint8Array buffer
 */
async function readResponse(response, progress_callback) {
  const contentLength = response.headers.get("Content-Length");
  if (contentLength === null) {
    console.warn(
      "Unable to determine content-length from response headers. Will expand buffer when needed.",
    );
  }
  let total = parseInt(contentLength ?? "0");
  let buffer = new Uint8Array(total);
  let loaded = 0;

  const reader = response.body.getReader();
  async function read() {
    const { done, value } = await reader.read();
    if (done) return;

    let newLoaded = loaded + value.length;
    if (newLoaded > total) {
      total = newLoaded;

      // Adding the new data will overflow buffer.
      // In this case, we extend the buffer
      let newBuffer = new Uint8Array(total);

      // copy contents
      newBuffer.set(buffer);

      buffer = newBuffer;
    }
    buffer.set(value, loaded);
    loaded = newLoaded;

    const progress = (loaded / total) * 100;

    // Call your function here
    progress_callback({
      progress: progress,
      loaded: loaded,
      total: total,
    });

    return read();
  }

  // Actually read
  await read();

  return buffer;
}

/**
 * Joins multiple parts of a path into a single path, while handling leading and trailing slashes.
 *
 * @param {...string} parts Multiple parts of a path.
 * @returns {string} A string representing the joined path.
 */
function pathJoin(...parts) {
  // https://stackoverflow.com/a/55142565
  parts = parts.map((part, index) => {
    if (index) {
      part = part.replace(new RegExp("^/"), "");
    }
    if (index !== parts.length - 1) {
      part = part.replace(new RegExp("/$"), "");
    }
    return part;
  });
  return parts.join("/");
}
