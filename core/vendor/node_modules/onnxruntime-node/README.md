# ONNX Runtime Node.js Binding

ONNX Runtime Node.js binding enables Node.js applications to run ONNX model inference.

## Usage

Install the latest stable version:

```
npm install onnxruntime-node
```

Refer to [ONNX Runtime JavaScript examples](https://github.com/microsoft/onnxruntime-inference-examples/tree/main/js) for samples and tutorials.

## Requirements

ONNXRuntime works on Node.js v12.x+ or Electron v5.x+.

Following platforms are supported with pre-built binaries:

- Windows x64 CPU NAPI_v3
- Linux x64 CPU NAPI_v3
- MacOS x64 CPU NAPI_v3

To use on platforms without pre-built binaries, you can build Node.js binding from source and consume it by `npm install <onnxruntime_repo_root>/js/node/`. See also [instructions](https://www.onnxruntime.ai/docs/how-to/build.html#apis-and-language-bindings) for building ONNX Runtime Node.js binding locally.

## License

License information can be found [here](https://github.com/microsoft/onnxruntime/blob/main/README.md#license).
