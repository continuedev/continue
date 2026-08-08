import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  addToTestDir,
  setUpTestDir,
  tearDownTestDir,
} from "../../../test/testDir";

import { TEST_CASES_WITH_DIFF, TEST_CASES_WITHOUT_DIFF } from "./testCases";
import {
  AutocompleteFileringTestInput,
  testAutocompleteFiltering,
} from "./util";

const filterTestCases = (tests: AutocompleteFileringTestInput[]) => {
  if (tests.some((test) => test.options?.only)) {
    return tests.filter((test) => test.options?.only);
  }

  return tests;
};

describe("Autocomplete filtering tests", () => {
  beforeAll(async () => {
    tearDownTestDir();
    setUpTestDir();
    addToTestDir([".continueignore"]);
  });

  afterAll(async () => {
    tearDownTestDir();
  });

  beforeEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  describe("Should return unmodified LLM output", () => {
    it.each(filterTestCases(TEST_CASES_WITHOUT_DIFF))(
      "$description",
      async (testCase) => {
        await testAutocompleteFiltering(testCase);
      },
    );
  });

  describe("Should return modified LLM output", () => {
    it.each(filterTestCases(TEST_CASES_WITH_DIFF))(
      "$description",
      async (testCase) => {
        await testAutocompleteFiltering(testCase);
      },
    );
  });
});
