import { ConfigMergeType } from "..";

type JsonObject = { [key: string]: any };

export function mergeJson(
  first: JsonObject,
  second: JsonObject,
  mergeBehavior?: ConfigMergeType
): any {
  first = { ...first };

  try {
    for (var key in second) {
      let secondValue = second[key];

      if (!(key in first) || mergeBehavior === "overwrite") {
        // New value
        first[key] = secondValue;
        continue;
      }

      const firstValue = first[key];
      if (Array.isArray(secondValue)) {
        // Array
        first[key] = [...firstValue, ...secondValue];
      } else if (typeof secondValue === "object") {
        // Object
        first[key] = mergeJson(firstValue, secondValue, mergeBehavior);
      } else {
        // Other (boolean, number, string)
        first[key] = secondValue;
      }
    }
    return first;
  } catch (e) {
    console.error("Error merging JSON", e, first, second);
    return {
      ...first,
      ...second,
    };
  }
}

export default mergeJson;
