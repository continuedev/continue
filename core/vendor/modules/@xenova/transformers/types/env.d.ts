export namespace env {
  export namespace backends {
    export { onnx_env as onnx };
    export let tfjs: {};
  }
  export { __dirname };
  export { VERSION as version };
  export let allowRemoteModels: boolean;
  export let remoteHost: string;
  export let remotePathTemplate: string;
  export let allowLocalModels: boolean;
  export { localModelPath };
  export { FS_AVAILABLE as useFS };
  export { WEB_CACHE_AVAILABLE as useBrowserCache };
  export { FS_AVAILABLE as useFSCache };
  export { DEFAULT_CACHE_DIR as cacheDir };
  export let useCustomCache: boolean;
  export let customCache: any;
}
declare const onnx_env: import("onnxruntime-common").Env;
declare const __dirname: any;
declare const VERSION: "2.14.0";
declare const localModelPath: any;
declare const FS_AVAILABLE: boolean;
declare const WEB_CACHE_AVAILABLE: boolean;
declare const DEFAULT_CACHE_DIR: any;
export {};
//# sourceMappingURL=env.d.ts.map
