import { ConfigMergeType } from "..";

type JsonObject = { [key: string]: any };

export function mergeJson(
  first: JsonObject,
  second: JsonObject,
  mergeBehavior?: ConfigMergeType,
  mergeKeys?: {[key: string]: (a: any, b: any) => boolean}
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
      if (Array.isArray(secondValue) && Array.isArray(firstValue)) {
        // Array
        if (mergeKeys?.[key]) {
          // Merge keys are used to determine whether an item form the second object should override one from the first
          let keptFromFirst: any[] = [];
          firstValue.forEach((item: any) => {
            if (!secondValue.some((item2: any) => mergeKeys[key](item, item2))) {
              keptFromFirst.push(item);
            }
          })
          first[key] = [...keptFromFirst, ...secondValue];
        } else {
          first[key] = [...firstValue, ...secondValue];
        }
      } else if (typeof secondValue === "object" && typeof firstValue === "object") {
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
