import { readFileSync, writeFileSync } from "fs";
import { ModelDescription } from "../index.js";
import { editConfigJson, getConfigJsonPath } from "../util/paths.js";

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
  const config = readFileSync(getConfigJsonPath(), "utf8");
  const configJson = JSON.parse(config);

  // De-duplicate
  if (configJson.models?.some((m: any) => stringify(m) === stringify(model))) {
    return config;
  }
  if (configJson.models?.some((m: any) => m?.title === model.title)) {
    model.title = `${model.title} (1)`;
  }

  configJson.models.push(model);
  const newConfigString = stringify(configJson, 2);
  writeFileSync(getConfigJsonPath(), newConfigString);
  return newConfigString;
}

export function addOpenAIKey(key: string) {
  editConfigJson((config) => {
    config.models = config.models.map((m: ModelDescription) => {
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
