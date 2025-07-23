// Main test file that imports all the individual test suites
import "./__tests__/TUIChat.basic.test.js";
import "./__tests__/TUIChat.messages.test.js";
import "./__tests__/TUIChat.input.test.js";
import "./__tests__/TUIChat.fileSearch.test.js";
import "./__tests__/TUIChat.slashCommands.test.js";
import "./TUIChat.advanced.test.js";

// Add a dummy test to satisfy Jest
describe("TUIChat Test Suite", () => {
  it("should import all test modules", () => {
    expect(true).toBe(true);
  });
});