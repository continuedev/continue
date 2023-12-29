type JsonObject = { [key: string]: any };

function mergeJson(first: JsonObject, second: JsonObject): any {
  for (var key in second) {
    let secondValue = second[key];

    if (!(key in first)) {
      // New value
      first[key] = secondValue;
    }

    const firstValue = first[key];
    if (Array.isArray(secondValue)) {
      // Array
      first[key] = [...firstValue, ...secondValue];
    } else if (typeof secondValue === "object") {
      // Object
      first[key] = mergeJson(firstValue, secondValue);
    } else {
      // Other (boolean, number, string)
      first[key] = secondValue;
    }
  }
  return first;
}

export default mergeJson;
