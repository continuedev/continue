import { dedent } from "../../util";
import { testAutocompleteFiltering } from "./util";

describe("llms/Mock", () => {
  it("should pass unless maybe I messed up the whitespace at the start or something idk", async () => {
    const input = dedent`
        class Calculator {
          constructor() {
            this.result = 0;
          }
  
          add(number) {
            this.result += number;
            return this;
          }
  
          subtract(number) {
            this.result -= number;
            return this;
          }
  
          multiply(number) {
            this.result *= number;
            return this;
          }
  
          divide(number) {
            <|fim|>
  
          getResult() {
            return this.result;
          }
  
          reset() {
            this.result = 0;
            return this;
          }
        }
  
      `;
    const completion = dedent`
        if (number === 0) {
            throw new Error("Cannot divide by zero");
        }
        this.result /= number;
        return this;
    }`;
    await testAutocompleteFiltering({
      input,
      completion,
      expectToDisplay: completion,
      description: "divide",
      filename: "test.js",
    });
  });

  it("should pass", async () => {
    await testAutocompleteFiltering({
      input: "console.log('Hello <|fim|>!');",
      completion: "World",
      expectToDisplay: "World",
      description: "Hello World",
      filename: "test.js",
    });
  });
});
