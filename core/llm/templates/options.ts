import { CompletionOptions } from "../../index.js";

const CompletionOptionsForModels: {
  [key: string]: Partial<CompletionOptions>;
} = {
  "codellama-70b": {
    stop: ["Source: assistant"],
  },
};

export default CompletionOptionsForModels;
