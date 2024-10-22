import { dedent } from "../../util";
import { AutocompleteFileringTestInput } from "./util";

export const testCases: AutocompleteFileringTestInput[] = [
  {
    description: "should pass",
    filename: "test.js",
    input: "console.log('Hello <|fim|>!');",
    llmOutput: "World",
    expectedCompletion: "World",
  },
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
    llmOutput: dedent`if (number === 0) {
            throw new Error("Cannot divide by zero");
        }
        this.result /= number;
        return this;
    }`,
    expectedCompletion: dedent`if (number === 0) {
            throw new Error("Cannot divide by zero");
        }
        this.result /= number;
        return this;
    }`,
  },
  {
    description: "Should multiline-autocomplete CSS blocks",
    input: `body {
  font-family: Arial, sans-serif;
  font-size: 16px;
  color: #333333;
}

h1 {
  font-size: 24px;
  font-weight: bold;
  color: #000000;
}

h4<|fim|>

a {
  text-decoration: none;
  color: #007bff;
}

.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.button {
  display: inline-block;
  padding: 10px 20px;
  background-color: #007bff;
  color: #ffffff;`,
    llmOutput: ` {
  font-size: 18px;
  font-weight: bold;
  color: #000000;
}`,
    expectedCompletion: ` {
  font-size: 18px;
  font-weight: bold;
  color: #000000;
}`,
    filename: "test.css",
  },
];
