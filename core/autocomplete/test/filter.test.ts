import { testAutocompleteFiltering } from "./util";
import { testCases } from "./testCases";

describe("llms/Mock", () => {
  describe("Autocomplete Filtering Tests", () => {
    it.each(testCases)("$description", async (testCase) => {
      await testAutocompleteFiltering(testCase);
    });
  });
});
