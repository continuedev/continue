import { ConfigMergeType } from "../index.js";

type JsonObject = { [key: string]: any };

export function mergeJson(
  first: JsonObject,
  second: JsonObject,
  mergeBehavior?: ConfigMergeType,
  mergeKeys?: { [key: string]: (a: any, b: any) => boolean },
): any {
  const copyOfFirst = JSON.parse(JSON.stringify(first));

  try {
    for (var key in second) {
      let secondValue = second[key];

      if (!(key in copyOfFirst) || mergeBehavior === "overwrite") {
        // New value
        copyOfFirst[key] = secondValue;
        continue;
      }

      const firstValue = copyOfFirst[key];
      if (Array.isArray(secondValue) && Array.isArray(firstValue)) {
        // Array
        if (mergeKeys?.[key]) {
          // Merge keys are used to determine whether an item form the second object should override one from the first
          let keptFromFirst: any[] = [];
          firstValue.forEach((item: any) => {
            if (
              !secondValue.some((item2: any) => mergeKeys[key](item, item2))
            ) {
              keptFromFirst.push(item);
            }
          });
          copyOfFirst[key] = [...keptFromFirst, ...secondValue];
        } else {
          copyOfFirst[key] = [...firstValue, ...secondValue];
        }
      } else if (
        typeof secondValue === "object" &&
        typeof firstValue === "object"
      ) {
        // Object
        copyOfFirst[key] = mergeJson(firstValue, secondValue, mergeBehavior);
      } else {
        // Other (boolean, number, string)
        copyOfFirst[key] = secondValue;
      }
    }
    return copyOfFirst;
  } catch (e) {
    console.error("Error merging JSON", e, copyOfFirst, second);
    return {
      ...copyOfFirst,
      ...second,
    };
  }
}

export default mergeJson;
