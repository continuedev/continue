import { test, describe } from "mocha";
import assert from "assert";
import { convertSingleToDoubleQuoteJSON } from "../util/util";

describe("utils.ts", () => {
  test("convertSingleToDoubleQuoteJson", () => {
    let pairs = [
      [`{'a': 'b'}`, `{"a": "b"}`],
      [`{'a': "b", "c": 'd'}`, `{"a": "b", "c": "d"}`],
      [`{'a': '\\'"'}`, `{"a": "'\\""}`],
    ];
    for (let pair of pairs) {
      let result = convertSingleToDoubleQuoteJSON(pair[0]);
      assert(result === pair[1]);
      JSON.parse(result);
    }
  });
});
