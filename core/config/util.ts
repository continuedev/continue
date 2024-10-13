import {
  ContextProviderWithParams,
  ContinueConfig,
  ILLM,
  ModelDescription,
  ModelRoles,
} from "../";
import { editConfigJson } from "../util/paths";

function stringify(obj: any, indentation?: number): string {
  return JSON.stringify(
    obj,
    (key, value) => {
      return value === null ? undefined : value;
    },
    indentation,
  );
}

export function addContextProvider(provider: ContextProviderWithParams) {
  editConfigJson((config) => {
    if (!config.contextProviders) {
      config.contextProviders = [provider];
    } else {
      config.contextProviders.push(provider);
    }

    return config;
  });
}

export function addModel(model: ModelDescription, role?: keyof ModelRoles) {
  editConfigJson((config) => {
    if (config.models?.some((m: any) => stringify(m) === stringify(model))) {
      return config;
    }
    if (config.models?.some((m: any) => m?.title === model.title)) {
      model.title = `${model.title} (1)`;
    }

    config.models.push(model);

    // Set the role for the model
    if (role) {
      if (!config.experimental) {
        config.experimental = {};
      }
      if (!config.experimental.modelRoles) {
        config.experimental.modelRoles = {};
      }
      config.experimental.modelRoles[role] = model.title;
    }

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

export function getModelByRole<T extends keyof ModelRoles>(
  config: ContinueConfig,
  role: T,
): ILLM | undefined {
  const roleTitle = config.experimental?.modelRoles?.[role];

  if (!roleTitle) {
    return undefined;
  }

  const matchingModel = config.models.find(
    (model) => model.title === roleTitle,
  );

  return matchingModel;
}
