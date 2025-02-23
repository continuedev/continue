import { fileURLToPath, pathToFileURL } from "url";

import * as URI from "uri-js";

// CAN ONLY BE USED IN CORE

// Converts a local path to a file:/// URI
export function localPathToUri(path: string) {
  const url = pathToFileURL(path);
  return URI.normalize(url.toString());
}

export function localPathOrUriToPath(localPathOrUri: string): string {
  try {
    return fileURLToPath(localPathOrUri);
  } catch (e) {
    // console.log("Received local filepath", localPathOrUri);

    return localPathOrUri;
  }
}
