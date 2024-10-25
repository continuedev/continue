import {
  AutocompleteFileringTestInput,
  testAutocompleteFiltering,
} from "./util";
import { TEST_CASES } from "./testCases";

const filterTestCases = (tests: AutocompleteFileringTestInput[]) => {
  if (tests.some((test) => test.options?.only)) {
    return tests.filter((test) => test.options?.only);
  }

  return tests;
};

describe("llms/Mock", () => {
  describe("Autocomplete Filtering Tests", () => {
    beforeEach(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    describe("Should return unmodified LLM output", () => {
      it.each(filterTestCases(TEST_CASES))("$description", async (testCase) => {
        await testAutocompleteFiltering(testCase);
      });
    });

    // TODO: Add test cases where modifying LLM output is desirable
    describe.skip("Should return modified LLM output", () => {});
  });
});
