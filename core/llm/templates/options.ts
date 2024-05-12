import { CompletionOptions, ModelName } from "../../index.js";

const CompletionOptionsForModels: {
  [key in ModelName]?: Partial<CompletionOptions>;
} = {
  "codellama-70b": {
    stop: ["Source: assistant"],
  },
};

export default CompletionOptionsForModels;
