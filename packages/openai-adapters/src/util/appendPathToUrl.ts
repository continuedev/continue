export function appendPathToUrlIfNotPresent(
  urlString: string,
  pathWithoutSlash: string,
) {
  const url = new URL(urlString);
  if (!url.pathname.endsWith("/")) {
    url.pathname += "/";
  }
  if (!url.pathname.endsWith(pathWithoutSlash + "/")) {
    url.pathname += pathWithoutSlash + "/";
  }
  if (url.search) {
    return url.toString();
  }
  // append slash at the end
  return url.toString();
}
