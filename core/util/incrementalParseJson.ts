export function incrementalParseJson(raw: string): [boolean, any] {
  try {
    return [true, JSON.parse(raw)];
  } catch (e) {
    return [false, {}];
  }
}
