import { dedent } from "../../util";
import { AutocompleteFileringTestInput } from "./util";

export const testCases: AutocompleteFileringTestInput[] = [
  {
    description:
      "Should preserve closing brackets when the opening bracket is not a part of the completion.",
    filename: "test.js",
    input: dedent`
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
    `,
    completion: dedent`if (number === 0) {
            throw new Error("Cannot divide by zero");
        }
        this.result /= number;
        return this;
    }`,
    expectToDisplay: dedent`if (number === 0) {
            throw new Error("Cannot divide by zero");
        }
        this.result /= number;
        return this;
    }`,
  },
  {
    description: "should pass",
    filename: "test.js",
    input: "console.log('Hello <|fim|>!');",
    completion: "World",
    expectToDisplay: "World",
  },
];
