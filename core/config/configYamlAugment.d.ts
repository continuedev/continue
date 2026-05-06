import "@yutoagentic/config-yaml";

declare module "@yutoagentic/config-yaml" {
  interface ConfigResult<T> {
    configName?: string;
  }
}

export {};
