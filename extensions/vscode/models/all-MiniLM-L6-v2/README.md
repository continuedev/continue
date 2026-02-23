---
library_name: "transformers.js"
---

https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2 with ONNX weights to be compatible with Transformers.js.

## Usage (Transformers.js)

If you haven't already, you can install the [Transformers.js](https://huggingface.co/docs/transformers.js) JavaScript library from [NPM](https://www.npmjs.com/package/@xenova/transformers) using:

```bash
npm i @xenova/transformers
```

You can then use the model to compute embeddings like this:

```js
import { pipeline } from "@xenova/transformers";

// Create a feature-extraction pipeline
const extractor = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2",
);

// Compute sentence embeddings
const sentences = ["This is an example sentence", "Each sentence is converted"];
const output = await extractor(sentences, { pooling: "mean", normalize: true });
console.log(output);
// Tensor {
//   dims: [ 2, 384 ],
//   type: 'float32',
//   data: Float32Array(768) [ 0.04592696577310562, 0.07328180968761444, ... ],
//   size: 768
// }
```

You can convert this Tensor to a nested JavaScript array using `.tolist()`:

```js
console.log(output.tolist());
// [
//   [ 0.04592696577310562, 0.07328180968761444, 0.05400655046105385, ... ],
//   [ 0.08188057690858841, 0.10760223120450974, -0.013241755776107311, ... ]
// ]
```

Note: Having a separate repo for ONNX weights is intended to be a temporary solution until WebML gains more traction. If you would like to make your models web-ready, we recommend converting to ONNX using [🤗 Optimum](https://huggingface.co/docs/optimum/index) and structuring your repo like this one (with ONNX weights located in a subfolder named `onnx`).
