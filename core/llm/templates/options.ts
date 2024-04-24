import { CompletionOptions, ModelName } from "../..";

const CompletionOptionsForModels: {
  [key in ModelName]?: Partial<CompletionOptions>;
} = {
  "codellama-70b": {
    stop: ["Source: assistant"],
  },
};

export default CompletionOptionsForModels;
