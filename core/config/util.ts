import { readFileSync, writeFileSync } from "fs";
import { ModelDescription } from "..";
import { editConfigJson, getConfigJsonPath } from "../util/paths";

export function addModel(model: ModelDescription) {
  const config = readFileSync(getConfigJsonPath(), "utf8");
  const configJson = JSON.parse(config);
  configJson.models.push(model);
  const newConfigString = JSON.stringify(
    configJson,
    (key, value) => {
      return value === null ? undefined : value;
    },
    2,
  );
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
