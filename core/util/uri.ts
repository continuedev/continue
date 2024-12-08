export function join(uri: string, segment: string) {
  return uri.replace(/\/*$/, "") + "/" + segment.replace(/^\/*/, "");
}
