import { fileURLToPath, pathToFileURL } from "url";

import * as URI from "uri-js";

// CAN ONLY BE USED IN CORE

// Converts a local path to a file:/// URI
export function localPathToUri(path: string) {
  // This may incidentally solve bugs, but it is primarily here to warn us if we accidentally try to double-convert. It doesn't handle other URI schemes.
  if (path.startsWith("file://")) {
    console.warn("localPathToUri: path already starts with file://");
    return path;
  }
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
