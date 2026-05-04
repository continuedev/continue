import "@continuedev/config-yaml";

declare module "@continuedev/config-yaml" {
  interface ConfigResult<T> {
    configName?: string;
  }
}

export {};
