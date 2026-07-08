import { parse } from "partial-json";

export function incrementalParseJson(raw: string): [boolean, any] {
  try {
    return [true, JSON.parse(raw)];
  } catch (e) {
    try {
      return [false, parse(raw)];
    } catch (e2) {
      return [false, {}];
    }
  }
}
