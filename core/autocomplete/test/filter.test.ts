import { testAutocompleteFiltering } from "./util";
import { testCases } from "./testCases";

describe("llms/Mock", () => {
  describe("Autocomplete Filtering Tests", () => {
    beforeEach(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    it.each(testCases)("$description", async (testCase) => {
      await testAutocompleteFiltering(testCase);
    });
  });
});
