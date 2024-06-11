import { ModelDescription } from "../index.js";
import { editConfigJson } from "../util/paths.js";

function stringify(obj: any, indentation?: number): string {
  return JSON.stringify(
    obj,
    (key, value) => {
      return value === null ? undefined : value;
    },
    indentation,
  );
}

export function addModel(model: ModelDescription) {
  editConfigJson((config) => {
    if (config.models?.some((m: any) => stringify(m) === stringify(model))) {
      return config;
    }
    if (config.models?.some((m: any) => m?.title === model.title)) {
      model.title = `${model.title} (1)`;
    }

    config.models.push(model);
    return config;
  });
}

export function addOpenAIKey(key: string) {
  editConfigJson((config) => {
    config.models = config.models
      .filter(
        (model) =>
          model.provider !== "free-trial" || model.model.startsWith("gpt"),
      )
      .map((m: ModelDescription) => {
        if (m.provider === "free-trial") {
          m.apiKey = key;
          m.provider = "openai";
        }
        return m;
      });
    return config;
  });
}

export function deleteModel(title: string) {
  editConfigJson((config) => {
    config.models = config.models.filter((m: any) => m.title !== title);
    return config;
  });
}
