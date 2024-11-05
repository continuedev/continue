import {
  AutocompleteFileringTestInput,
  testAutocompleteFiltering,
} from "./util";
import { TEST_CASES } from "./testCases";
import { setUpTestDir, tearDownTestDir } from "../../../test/util/testDir";

const filterTestCases = (tests: AutocompleteFileringTestInput[]) => {
  if (tests.some((test) => test.options?.only)) {
    return tests.filter((test) => test.options?.only);
  }

  return tests;
};

describe("llms/Mock", () => {
  beforeAll(async () => {
    tearDownTestDir();
    setUpTestDir();
  });

  afterAll(async () => {
    tearDownTestDir();
  });

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
