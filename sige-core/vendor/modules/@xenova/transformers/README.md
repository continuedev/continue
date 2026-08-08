<p align="center">
    <br/>
    <picture> 
        <source media="(prefers-color-scheme: dark)" srcset="https://huggingface.co/datasets/Xenova/transformers.js-docs/raw/main/transformersjs-dark.svg" width="500" style="max-width: 100%;">
        <source media="(prefers-color-scheme: light)" srcset="https://huggingface.co/datasets/Xenova/transformers.js-docs/raw/main/transformersjs-light.svg" width="500" style="max-width: 100%;">
        <img alt="transformers.js javascript library logo" src="https://huggingface.co/datasets/Xenova/transformers.js-docs/raw/main/transformersjs-light.svg" width="500" style="max-width: 100%;">
    </picture>
    <br/>
</p>

<p align="center">
    <a href="https://www.npmjs.com/package/@xenova/transformers">
        <img alt="NPM" src="https://img.shields.io/npm/v/@xenova/transformers">
    </a>
    <a href="https://www.npmjs.com/package/@xenova/transformers">
        <img alt="NPM Downloads" src="https://img.shields.io/npm/dw/@xenova/transformers">
    </a>
    <a href="https://www.jsdelivr.com/package/npm/@xenova/transformers">
        <img alt="jsDelivr Hits" src="https://img.shields.io/jsdelivr/npm/hw/@xenova/transformers">
    </a>
    <a href="https://github.com/xenova/transformers.js/blob/main/LICENSE">
        <img alt="License" src="https://img.shields.io/github/license/xenova/transformers.js?color=blue">
    </a>
    <a href="https://huggingface.co/docs/transformers.js/index">
        <img alt="Documentation" src="https://img.shields.io/website/http/huggingface.co/docs/transformers.js/index.svg?down_color=red&down_message=offline&up_message=online">
    </a>
</p>

State-of-the-art Machine Learning for the web. Run 🤗 Transformers directly in your browser, with no need for a server!

Transformers.js is designed to be functionally equivalent to Hugging Face's [transformers](https://github.com/huggingface/transformers) python library, meaning you can run the same pretrained models using a very similar API. These models support common tasks in different modalities, such as:

- 📝 **Natural Language Processing**: text classification, named entity recognition, question answering, language modeling, summarization, translation, multiple choice, and text generation.
- 🖼️ **Computer Vision**: image classification, object detection, and segmentation.
- 🗣️ **Audio**: automatic speech recognition and audio classification.
- 🐙 **Multimodal**: zero-shot image classification.

Transformers.js uses [ONNX Runtime](https://onnxruntime.ai/) to run models in the browser. The best part about it, is that you can easily [convert](#convert-your-models-to-onnx) your pretrained PyTorch, TensorFlow, or JAX models to ONNX using [🤗 Optimum](https://github.com/huggingface/optimum#onnx--onnx-runtime).

For more information, check out the full [documentation](https://huggingface.co/docs/transformers.js).

## Quick tour

It's super simple to translate from existing code! Just like the python library, we support the `pipeline` API. Pipelines group together a pretrained model with preprocessing of inputs and postprocessing of outputs, making it the easiest way to run models with the library.

<table>
<tr>
<th width="440px" align="center"><b>Python (original)</b></th>
<th width="440px" align="center"><b>Javascript (ours)</b></th>
</tr>
<tr>
<td>

```python
from transformers import pipeline

# Allocate a pipeline for sentiment-analysis
pipe = pipeline('sentiment-analysis')

out = pipe('I love transformers!')
# [{'label': 'POSITIVE', 'score': 0.999806941}]
```

</td>
<td>

```javascript
import { pipeline } from "@xenova/transformers";

// Allocate a pipeline for sentiment-analysis
let pipe = await pipeline("sentiment-analysis");

let out = await pipe("I love transformers!");
// [{'label': 'POSITIVE', 'score': 0.999817686}]
```

</td>
</tr>
</table>

You can also use a different model by specifying the model id or path as the second argument to the `pipeline` function. For example:

```javascript
// Use a different model for sentiment-analysis
let pipe = await pipeline(
  "sentiment-analysis",
  "Xenova/bert-base-multilingual-uncased-sentiment",
);
```

## Installation

To install via [NPM](https://www.npmjs.com/package/@xenova/transformers), run:

```bash
npm i @xenova/transformers
```

Alternatively, you can use it in vanilla JS, without any bundler, by using a CDN or static hosting. For example, using [ES Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), you can import the library with:

```html
<script type="module">
  import { pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0";
</script>
```

## Examples

Want to jump straight in? Get started with one of our sample applications/templates:

| Name                                | Description                               | Links                                                                                                                                                     |
| ----------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whisper Web                         | Speech recognition w/ Whisper             | [code](https://github.com/xenova/whisper-web), [demo](https://huggingface.co/spaces/Xenova/whisper-web)                                                   |
| Doodle Dash                         | Real-time sketch-recognition game         | [blog](https://huggingface.co/blog/ml-web-games), [code](https://github.com/xenova/doodle-dash), [demo](https://huggingface.co/spaces/Xenova/doodle-dash) |
| Code Playground                     | In-browser code completion website        | [code](./examples/code-completion/), [demo](https://huggingface.co/spaces/Xenova/ai-code-playground)                                                      |
| Semantic Image Search (client-side) | Search for images with text               | [code](./examples/semantic-image-search-client/), [demo](https://huggingface.co/spaces/Xenova/semantic-image-search-client)                               |
| Semantic Image Search (server-side) | Search for images with text (Supabase)    | [code](./examples/semantic-image-search/), [demo](https://huggingface.co/spaces/Xenova/semantic-image-search)                                             |
| Vanilla JavaScript                  | In-browser object detection               | [video](https://scrimba.com/scrim/cKm9bDAg), [code](./examples/vanilla-js/), [demo](https://huggingface.co/spaces/Scrimba/vanilla-js-object-detector)     |
| React                               | Multilingual translation website          | [code](./examples/react-translator/), [demo](https://huggingface.co/spaces/Xenova/react-translator)                                                       |
| Text to speech (client-side)        | In-browser speech synthesis               | [code](./examples/text-to-speech-client/), [demo](https://huggingface.co/spaces/Xenova/text-to-speech-client)                                             |
| Browser extension                   | Text classification extension             | [code](./examples/extension/)                                                                                                                             |
| Electron                            | Text classification application           | [code](./examples/electron/)                                                                                                                              |
| Next.js (client-side)               | Sentiment analysis (in-browser inference) | [code](./examples/next-client/), [demo](https://huggingface.co/spaces/Xenova/next-example-app)                                                            |
| Next.js (server-side)               | Sentiment analysis (Node.js inference)    | [code](./examples/next-server/), [demo](https://huggingface.co/spaces/Xenova/next-server-example-app)                                                     |
| Node.js                             | Sentiment analysis API                    | [code](./examples/node/)                                                                                                                                  |
| Demo site                           | A collection of demos                     | [code](./examples/demo-site/), [demo](https://xenova.github.io/transformers.js/)                                                                          |

Check out the Transformers.js [template](https://huggingface.co/new-space?template=static-templates%2Ftransformers.js) on Hugging Face to get started in one click!

## Custom usage

By default, Transformers.js uses [hosted pretrained models](https://huggingface.co/models?library=transformers.js) and [precompiled WASM binaries](https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0/dist/), which should work out-of-the-box. You can customize this as follows:

### Settings

```javascript
import { env } from "@xenova/transformers";

// Specify a custom location for models (defaults to '/models/').
env.localModelPath = "/path/to/models/";

// Disable the loading of remote models from the Hugging Face Hub:
env.allowRemoteModels = false;

// Set location of .wasm files. Defaults to use a CDN.
env.backends.onnx.wasm.wasmPaths = "/path/to/files/";
```

For a full list of available settings, check out the [API Reference](https://huggingface.co/docs/transformers.js/api/env).

### Convert your models to ONNX

We recommend using our [conversion script](https://github.com/xenova/transformers.js/blob/main/scripts/convert.py) to convert your PyTorch, TensorFlow, or JAX models to ONNX in a single command. Behind the scenes, it uses [🤗 Optimum](https://huggingface.co/docs/optimum) to perform conversion and quantization of your model.

```bash
python -m scripts.convert --quantize --model_id <model_name_or_path>
```

For example, convert and quantize [bert-base-uncased](https://huggingface.co/bert-base-uncased) using:

```bash
python -m scripts.convert --quantize --model_id bert-base-uncased
```

This will save the following files to `./models/`:

```
bert-base-uncased/
├── config.json
├── tokenizer.json
├── tokenizer_config.json
└── onnx/
    ├── model.onnx
    └── model_quantized.onnx
```

For the full list of supported architectures, see the [Optimum documentation](https://huggingface.co/docs/optimum/main/en/exporters/onnx/overview).

## Supported tasks/models

Here is the list of all tasks and architectures currently supported by Transformers.js.
If you don't see your task/model listed here or it is not yet supported, feel free
to open up a feature request [here](https://github.com/xenova/transformers.js/issues/new/choose).

To find compatible models on the Hub, select the "transformers.js" library tag in the filter menu (or visit [this link](https://huggingface.co/models?library=transformers.js)).
You can refine your search by selecting the task you're interested in (e.g., [text-classification](https://huggingface.co/models?pipeline_tag=text-classification&library=transformers.js)).

### Tasks

#### Natural Language Processing

| Task                                                                                                   | ID                                            | Description                                                                                    | Supported?                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Conversational](https://huggingface.co/tasks/conversational)                                          | `conversational`                              | Generating conversational text that is relevant, coherent and knowledgable given a prompt.     | ❌                                                                                                                                                                                                                                |
| [Fill-Mask](https://huggingface.co/tasks/fill-mask)                                                    | `fill-mask`                                   | Masking some of the words in a sentence and predicting which words should replace those masks. | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.FillMaskPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=fill-mask&library=transformers.js)                              |
| [Question Answering](https://huggingface.co/tasks/question-answering)                                  | `question-answering`                          | Retrieve the answer to a question from a given text.                                           | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.QuestionAnsweringPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=question-answering&library=transformers.js)            |
| [Sentence Similarity](https://huggingface.co/tasks/sentence-similarity)                                | `sentence-similarity`                         | Determining how similar two texts are.                                                         | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.FeatureExtractionPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=feature-extraction&library=transformers.js)            |
| [Summarization](https://huggingface.co/tasks/summarization)                                            | `summarization`                               | Producing a shorter version of a document while preserving its important information.          | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.SummarizationPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=summarization&library=transformers.js)                     |
| [Table Question Answering](https://huggingface.co/tasks/table-question-answering)                      | `table-question-answering`                    | Answering a question about information from a given table.                                     | ❌                                                                                                                                                                                                                                |
| [Text Classification](https://huggingface.co/tasks/text-classification)                                | `text-classification` or `sentiment-analysis` | Assigning a label or class to a given text.                                                    | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.TextClassificationPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=text-classification&library=transformers.js)          |
| [Text Generation](https://huggingface.co/tasks/text-generation#completion-generation-models)           | `text-generation`                             | Producing new text by predicting the next word in a sequence.                                  | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.TextGenerationPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=text-generation&library=transformers.js)                  |
| [Text-to-text Generation](https://huggingface.co/tasks/text-generation#text-to-text-generation-models) | `text2text-generation`                        | Converting one text sequence into another text sequence.                                       | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.Text2TextGenerationPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=text2text-generation&library=transformers.js)        |
| [Token Classification](https://huggingface.co/tasks/token-classification)                              | `token-classification` or `ner`               | Assigning a label to each token in a text.                                                     | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.TokenClassificationPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=token-classification&library=transformers.js)        |
| [Translation](https://huggingface.co/tasks/translation)                                                | `translation`                                 | Converting text from one language to another.                                                  | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.TranslationPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=translation&library=transformers.js)                         |
| [Zero-Shot Classification](https://huggingface.co/tasks/zero-shot-classification)                      | `zero-shot-classification`                    | Classifying text into classes that are unseen during training.                                 | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.ZeroShotClassificationPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=zero-shot-classification&library=transformers.js) |

#### Vision

| Task                                                                                          | ID                     | Description                                                                                                                                                                             | Supported?                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Depth Estimation](https://huggingface.co/tasks/depth-estimation)                             | `depth-estimation`     | Predicting the depth of objects present in an image.                                                                                                                                    | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.DepthEstimationPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=depth-estimation&library=transformers.js)         |
| [Image Classification](https://huggingface.co/tasks/image-classification)                     | `image-classification` | Assigning a label or class to an entire image.                                                                                                                                          | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.ImageClassificationPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=image-classification&library=transformers.js) |
| [Image Segmentation](https://huggingface.co/tasks/image-segmentation)                         | `image-segmentation`   | Divides an image into segments where each pixel is mapped to an object. This task has multiple variants such as instance segmentation, panoptic segmentation and semantic segmentation. | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.ImageSegmentationPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=image-segmentation&library=transformers.js)     |
| [Image-to-Image](https://huggingface.co/tasks/image-to-image)                                 | `image-to-image`       | Transforming a source image to match the characteristics of a target image or a target image domain.                                                                                    | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.ImageToImagePipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=image-to-image&library=transformers.js)              |
| [Mask Generation](https://huggingface.co/tasks/mask-generation)                               | `mask-generation`      | Generate masks for the objects in an image.                                                                                                                                             | ❌                                                                                                                                                                                                                         |
| [Object Detection](https://huggingface.co/tasks/object-detection)                             | `object-detection`     | Identify objects of certain defined classes within an image.                                                                                                                            | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.ObjectDetectionPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=object-detection&library=transformers.js)         |
| [Video Classification](https://huggingface.co/tasks/video-classification)                     | n/a                    | Assigning a label or class to an entire video.                                                                                                                                          | ❌                                                                                                                                                                                                                         |
| [Unconditional Image Generation](https://huggingface.co/tasks/unconditional-image-generation) | n/a                    | Generating images with no condition in any context (like a prompt text or another image).                                                                                               | ❌                                                                                                                                                                                                                         |

#### Audio

| Task                                                                                      | ID                                  | Description                                          | Supported?                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Audio Classification](https://huggingface.co/tasks/audio-classification)                 | `audio-classification`              | Assigning a label or class to a given audio.         | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.AudioClassificationPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=audio-classification&library=transformers.js)                |
| [Audio-to-Audio](https://huggingface.co/tasks/audio-to-audio)                             | n/a                                 | Generating audio from an input audio source.         | ❌                                                                                                                                                                                                                                        |
| [Automatic Speech Recognition](https://huggingface.co/tasks/automatic-speech-recognition) | `automatic-speech-recognition`      | Transcribing a given audio into text.                | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.AutomaticSpeechRecognitionPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=automatic-speech-recognition&library=transformers.js) |
| [Text-to-Speech](https://huggingface.co/tasks/text-to-speech)                             | `text-to-speech` or `text-to-audio` | Generating natural-sounding speech given text input. | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.TextToAudioPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=text-to-audio&library=transformers.js)                               |

#### Tabular

| Task                                                                          | ID  | Description                                                         | Supported? |
| ----------------------------------------------------------------------------- | --- | ------------------------------------------------------------------- | ---------- |
| [Tabular Classification](https://huggingface.co/tasks/tabular-classification) | n/a | Classifying a target category (a group) based on set of attributes. | ❌         |
| [Tabular Regression](https://huggingface.co/tasks/tabular-regression)         | n/a | Predicting a numerical value given a set of attributes.             | ❌         |

#### Multimodal

| Task                                                                                                                                      | ID                               | Description                                                                                                                   | Supported?                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Document Question Answering](https://huggingface.co/tasks/document-question-answering)                                                   | `document-question-answering`    | Answering questions on document images.                                                                                       | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.DocumentQuestionAnsweringPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=document-question-answering&library=transformers.js)      |
| [Feature Extraction](https://huggingface.co/tasks/feature-extraction)                                                                     | `feature-extraction`             | Transforming raw data into numerical features that can be processed while preserving the information in the original dataset. | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.FeatureExtractionPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=feature-extraction&library=transformers.js)                       |
| [Image-to-Text](https://huggingface.co/tasks/image-to-text)                                                                               | `image-to-text`                  | Output text from a given image.                                                                                               | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.ImageToTextPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=image-to-text&library=transformers.js)                                  |
| [Text-to-Image](https://huggingface.co/tasks/text-to-image)                                                                               | `text-to-image`                  | Generates images from input text.                                                                                             | ❌                                                                                                                                                                                                                                           |
| [Visual Question Answering](https://huggingface.co/tasks/visual-question-answering)                                                       | `visual-question-answering`      | Answering open-ended questions based on an image.                                                                             | ❌                                                                                                                                                                                                                                           |
| [Zero-Shot Audio Classification](https://huggingface.co/learn/audio-course/chapter4/classification_models#zero-shot-audio-classification) | `zero-shot-audio-classification` | Classifying audios into classes that are unseen during training.                                                              | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.ZeroShotAudioClassificationPipeline)<br>[(models)](https://huggingface.co/models?other=zero-shot-audio-classification&library=transformers.js)        |
| [Zero-Shot Image Classification](https://huggingface.co/tasks/zero-shot-image-classification)                                             | `zero-shot-image-classification` | Classifying images into classes that are unseen during training.                                                              | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.ZeroShotImageClassificationPipeline)<br>[(models)](https://huggingface.co/models?pipeline_tag=zero-shot-image-classification&library=transformers.js) |
| [Zero-Shot Object Detection](https://huggingface.co/tasks/zero-shot-object-detection)                                                     | `zero-shot-object-detection`     | Identify objects of classes that are unseen during training.                                                                  | ✅ [(docs)](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.ZeroShotObjectDetectionPipeline)<br>[(models)](https://huggingface.co/models?other=zero-shot-object-detection&library=transformers.js)                |

#### Reinforcement Learning

| Task                                                                          | ID  | Description                                                                                                                                | Supported? |
| ----------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| [Reinforcement Learning](https://huggingface.co/tasks/reinforcement-learning) | n/a | Learning from actions by interacting with an environment through trial and error and receiving rewards (negative or positive) as feedback. | ❌         |

### Models

1. **[ALBERT](https://huggingface.co/docs/transformers/model_doc/albert)** (from Google Research and the Toyota Technological Institute at Chicago) released with the paper [ALBERT: A Lite BERT for Self-supervised Learning of Language Representations](https://arxiv.org/abs/1909.11942), by Zhenzhong Lan, Mingda Chen, Sebastian Goodman, Kevin Gimpel, Piyush Sharma, Radu Soricut.
1. **[Audio Spectrogram Transformer](https://huggingface.co/docs/transformers/model_doc/audio-spectrogram-transformer)** (from MIT) released with the paper [AST: Audio Spectrogram Transformer](https://arxiv.org/abs/2104.01778) by Yuan Gong, Yu-An Chung, James Glass.
1. **[BART](https://huggingface.co/docs/transformers/model_doc/bart)** (from Facebook) released with the paper [BART: Denoising Sequence-to-Sequence Pre-training for Natural Language Generation, Translation, and Comprehension](https://arxiv.org/abs/1910.13461) by Mike Lewis, Yinhan Liu, Naman Goyal, Marjan Ghazvininejad, Abdelrahman Mohamed, Omer Levy, Ves Stoyanov and Luke Zettlemoyer.
1. **[BEiT](https://huggingface.co/docs/transformers/model_doc/beit)** (from Microsoft) released with the paper [BEiT: BERT Pre-Training of Image Transformers](https://arxiv.org/abs/2106.08254) by Hangbo Bao, Li Dong, Furu Wei.
1. **[BERT](https://huggingface.co/docs/transformers/model_doc/bert)** (from Google) released with the paper [BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding](https://arxiv.org/abs/1810.04805) by Jacob Devlin, Ming-Wei Chang, Kenton Lee and Kristina Toutanova.
1. **[Blenderbot](https://huggingface.co/docs/transformers/model_doc/blenderbot)** (from Facebook) released with the paper [Recipes for building an open-domain chatbot](https://arxiv.org/abs/2004.13637) by Stephen Roller, Emily Dinan, Naman Goyal, Da Ju, Mary Williamson, Yinhan Liu, Jing Xu, Myle Ott, Kurt Shuster, Eric M. Smith, Y-Lan Boureau, Jason Weston.
1. **[BlenderbotSmall](https://huggingface.co/docs/transformers/model_doc/blenderbot-small)** (from Facebook) released with the paper [Recipes for building an open-domain chatbot](https://arxiv.org/abs/2004.13637) by Stephen Roller, Emily Dinan, Naman Goyal, Da Ju, Mary Williamson, Yinhan Liu, Jing Xu, Myle Ott, Kurt Shuster, Eric M. Smith, Y-Lan Boureau, Jason Weston.
1. **[BLOOM](https://huggingface.co/docs/transformers/model_doc/bloom)** (from BigScience workshop) released by the [BigScience Workshop](https://bigscience.huggingface.co/).
1. **[CamemBERT](https://huggingface.co/docs/transformers/model_doc/camembert)** (from Inria/Facebook/Sorbonne) released with the paper [CamemBERT: a Tasty French Language Model](https://arxiv.org/abs/1911.03894) by Louis Martin*, Benjamin Muller*, Pedro Javier Ortiz Suárez\*, Yoann Dupont, Laurent Romary, Éric Villemonte de la Clergerie, Djamé Seddah and Benoît Sagot.
1. **[Chinese-CLIP](https://huggingface.co/docs/transformers/model_doc/chinese_clip)** (from OFA-Sys) released with the paper [Chinese CLIP: Contrastive Vision-Language Pretraining in Chinese](https://arxiv.org/abs/2211.01335) by An Yang, Junshu Pan, Junyang Lin, Rui Men, Yichang Zhang, Jingren Zhou, Chang Zhou.
1. **[CLAP](https://huggingface.co/docs/transformers/model_doc/clap)** (from LAION-AI) released with the paper [Large-scale Contrastive Language-Audio Pretraining with Feature Fusion and Keyword-to-Caption Augmentation](https://arxiv.org/abs/2211.06687) by Yusong Wu, Ke Chen, Tianyu Zhang, Yuchen Hui, Taylor Berg-Kirkpatrick, Shlomo Dubnov.
1. **[CLIP](https://huggingface.co/docs/transformers/model_doc/clip)** (from OpenAI) released with the paper [Learning Transferable Visual Models From Natural Language Supervision](https://arxiv.org/abs/2103.00020) by Alec Radford, Jong Wook Kim, Chris Hallacy, Aditya Ramesh, Gabriel Goh, Sandhini Agarwal, Girish Sastry, Amanda Askell, Pamela Mishkin, Jack Clark, Gretchen Krueger, Ilya Sutskever.
1. **[CLIPSeg](https://huggingface.co/docs/transformers/model_doc/clipseg)** (from University of Göttingen) released with the paper [Image Segmentation Using Text and Image Prompts](https://arxiv.org/abs/2112.10003) by Timo Lüddecke and Alexander Ecker.
1. **[CodeGen](https://huggingface.co/docs/transformers/model_doc/codegen)** (from Salesforce) released with the paper [A Conversational Paradigm for Program Synthesis](https://arxiv.org/abs/2203.13474) by Erik Nijkamp, Bo Pang, Hiroaki Hayashi, Lifu Tu, Huan Wang, Yingbo Zhou, Silvio Savarese, Caiming Xiong.
1. **[CodeLlama](https://huggingface.co/docs/transformers/model_doc/llama_code)** (from MetaAI) released with the paper [Code Llama: Open Foundation Models for Code](https://ai.meta.com/research/publications/code-llama-open-foundation-models-for-code/) by Baptiste Rozière, Jonas Gehring, Fabian Gloeckle, Sten Sootla, Itai Gat, Xiaoqing Ellen Tan, Yossi Adi, Jingyu Liu, Tal Remez, Jérémy Rapin, Artyom Kozhevnikov, Ivan Evtimov, Joanna Bitton, Manish Bhatt, Cristian Canton Ferrer, Aaron Grattafiori, Wenhan Xiong, Alexandre Défossez, Jade Copet, Faisal Azhar, Hugo Touvron, Louis Martin, Nicolas Usunier, Thomas Scialom, Gabriel Synnaeve.
1. **[ConvBERT](https://huggingface.co/docs/transformers/model_doc/convbert)** (from YituTech) released with the paper [ConvBERT: Improving BERT with Span-based Dynamic Convolution](https://arxiv.org/abs/2008.02496) by Zihang Jiang, Weihao Yu, Daquan Zhou, Yunpeng Chen, Jiashi Feng, Shuicheng Yan.
1. **[ConvNeXT](https://huggingface.co/docs/transformers/model_doc/convnext)** (from Facebook AI) released with the paper [A ConvNet for the 2020s](https://arxiv.org/abs/2201.03545) by Zhuang Liu, Hanzi Mao, Chao-Yuan Wu, Christoph Feichtenhofer, Trevor Darrell, Saining Xie.
1. **[ConvNeXTV2](https://huggingface.co/docs/transformers/model_doc/convnextv2)** (from Facebook AI) released with the paper [ConvNeXt V2: Co-designing and Scaling ConvNets with Masked Autoencoders](https://arxiv.org/abs/2301.00808) by Sanghyun Woo, Shoubhik Debnath, Ronghang Hu, Xinlei Chen, Zhuang Liu, In So Kweon, Saining Xie.
1. **[DeBERTa](https://huggingface.co/docs/transformers/model_doc/deberta)** (from Microsoft) released with the paper [DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654) by Pengcheng He, Xiaodong Liu, Jianfeng Gao, Weizhu Chen.
1. **[DeBERTa-v2](https://huggingface.co/docs/transformers/model_doc/deberta-v2)** (from Microsoft) released with the paper [DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654) by Pengcheng He, Xiaodong Liu, Jianfeng Gao, Weizhu Chen.
1. **[DeiT](https://huggingface.co/docs/transformers/model_doc/deit)** (from Facebook) released with the paper [Training data-efficient image transformers & distillation through attention](https://arxiv.org/abs/2012.12877) by Hugo Touvron, Matthieu Cord, Matthijs Douze, Francisco Massa, Alexandre Sablayrolles, Hervé Jégou.
1. **[DETR](https://huggingface.co/docs/transformers/model_doc/detr)** (from Facebook) released with the paper [End-to-End Object Detection with Transformers](https://arxiv.org/abs/2005.12872) by Nicolas Carion, Francisco Massa, Gabriel Synnaeve, Nicolas Usunier, Alexander Kirillov, Sergey Zagoruyko.
1. **[DINOv2](https://huggingface.co/docs/transformers/model_doc/dinov2)** (from Meta AI) released with the paper [DINOv2: Learning Robust Visual Features without Supervision](https://arxiv.org/abs/2304.07193) by Maxime Oquab, Timothée Darcet, Théo Moutakanni, Huy Vo, Marc Szafraniec, Vasil Khalidov, Pierre Fernandez, Daniel Haziza, Francisco Massa, Alaaeldin El-Nouby, Mahmoud Assran, Nicolas Ballas, Wojciech Galuba, Russell Howes, Po-Yao Huang, Shang-Wen Li, Ishan Misra, Michael Rabbat, Vasu Sharma, Gabriel Synnaeve, Hu Xu, Hervé Jegou, Julien Mairal, Patrick Labatut, Armand Joulin, Piotr Bojanowski.
1. **[DistilBERT](https://huggingface.co/docs/transformers/model_doc/distilbert)** (from HuggingFace), released together with the paper [DistilBERT, a distilled version of BERT: smaller, faster, cheaper and lighter](https://arxiv.org/abs/1910.01108) by Victor Sanh, Lysandre Debut and Thomas Wolf. The same method has been applied to compress GPT2 into [DistilGPT2](https://github.com/huggingface/transformers/tree/main/examples/research_projects/distillation), RoBERTa into [DistilRoBERTa](https://github.com/huggingface/transformers/tree/main/examples/research_projects/distillation), Multilingual BERT into [DistilmBERT](https://github.com/huggingface/transformers/tree/main/examples/research_projects/distillation) and a German version of DistilBERT.
1. **[DiT](https://huggingface.co/docs/transformers/model_doc/dit)** (from Microsoft Research) released with the paper [DiT: Self-supervised Pre-training for Document Image Transformer](https://arxiv.org/abs/2203.02378) by Junlong Li, Yiheng Xu, Tengchao Lv, Lei Cui, Cha Zhang, Furu Wei.
1. **[Donut](https://huggingface.co/docs/transformers/model_doc/donut)** (from NAVER), released together with the paper [OCR-free Document Understanding Transformer](https://arxiv.org/abs/2111.15664) by Geewook Kim, Teakgyu Hong, Moonbin Yim, Jeongyeon Nam, Jinyoung Park, Jinyeong Yim, Wonseok Hwang, Sangdoo Yun, Dongyoon Han, Seunghyun Park.
1. **[DPT](https://huggingface.co/docs/transformers/master/model_doc/dpt)** (from Intel Labs) released with the paper [Vision Transformers for Dense Prediction](https://arxiv.org/abs/2103.13413) by René Ranftl, Alexey Bochkovskiy, Vladlen Koltun.
1. **[ELECTRA](https://huggingface.co/docs/transformers/model_doc/electra)** (from Google Research/Stanford University) released with the paper [ELECTRA: Pre-training text encoders as discriminators rather than generators](https://arxiv.org/abs/2003.10555) by Kevin Clark, Minh-Thang Luong, Quoc V. Le, Christopher D. Manning.
1. **[ESM](https://huggingface.co/docs/transformers/model_doc/esm)** (from Meta AI) are transformer protein language models. **ESM-1b** was released with the paper [Biological structure and function emerge from scaling unsupervised learning to 250 million protein sequences](https://www.pnas.org/content/118/15/e2016239118) by Alexander Rives, Joshua Meier, Tom Sercu, Siddharth Goyal, Zeming Lin, Jason Liu, Demi Guo, Myle Ott, C. Lawrence Zitnick, Jerry Ma, and Rob Fergus. **ESM-1v** was released with the paper [Language models enable zero-shot prediction of the effects of mutations on protein function](https://doi.org/10.1101/2021.07.09.450648) by Joshua Meier, Roshan Rao, Robert Verkuil, Jason Liu, Tom Sercu and Alexander Rives. **ESM-2 and ESMFold** were released with the paper [Language models of protein sequences at the scale of evolution enable accurate structure prediction](https://doi.org/10.1101/2022.07.20.500902) by Zeming Lin, Halil Akin, Roshan Rao, Brian Hie, Zhongkai Zhu, Wenting Lu, Allan dos Santos Costa, Maryam Fazel-Zarandi, Tom Sercu, Sal Candido, Alexander Rives.
1. **[Falcon](https://huggingface.co/docs/transformers/model_doc/falcon)** (from Technology Innovation Institute) by Almazrouei, Ebtesam and Alobeidli, Hamza and Alshamsi, Abdulaziz and Cappelli, Alessandro and Cojocaru, Ruxandra and Debbah, Merouane and Goffinet, Etienne and Heslow, Daniel and Launay, Julien and Malartic, Quentin and Noune, Badreddine and Pannier, Baptiste and Penedo, Guilherme.
1. **[FLAN-T5](https://huggingface.co/docs/transformers/model_doc/flan-t5)** (from Google AI) released in the repository [google-research/t5x](https://github.com/google-research/t5x/blob/main/docs/models.md#flan-t5-checkpoints) by Hyung Won Chung, Le Hou, Shayne Longpre, Barret Zoph, Yi Tay, William Fedus, Eric Li, Xuezhi Wang, Mostafa Dehghani, Siddhartha Brahma, Albert Webson, Shixiang Shane Gu, Zhuyun Dai, Mirac Suzgun, Xinyun Chen, Aakanksha Chowdhery, Sharan Narang, Gaurav Mishra, Adams Yu, Vincent Zhao, Yanping Huang, Andrew Dai, Hongkun Yu, Slav Petrov, Ed H. Chi, Jeff Dean, Jacob Devlin, Adam Roberts, Denny Zhou, Quoc V. Le, and Jason Wei
1. **[GLPN](https://huggingface.co/docs/transformers/model_doc/glpn)** (from KAIST) released with the paper [Global-Local Path Networks for Monocular Depth Estimation with Vertical CutDepth](https://arxiv.org/abs/2201.07436) by Doyeon Kim, Woonghyun Ga, Pyungwhan Ahn, Donggyu Joo, Sehwan Chun, Junmo Kim.
1. **[GPT Neo](https://huggingface.co/docs/transformers/model_doc/gpt_neo)** (from EleutherAI) released in the repository [EleutherAI/gpt-neo](https://github.com/EleutherAI/gpt-neo) by Sid Black, Stella Biderman, Leo Gao, Phil Wang and Connor Leahy.
1. **[GPT NeoX](https://huggingface.co/docs/transformers/model_doc/gpt_neox)** (from EleutherAI) released with the paper [GPT-NeoX-20B: An Open-Source Autoregressive Language Model](https://arxiv.org/abs/2204.06745) by Sid Black, Stella Biderman, Eric Hallahan, Quentin Anthony, Leo Gao, Laurence Golding, Horace He, Connor Leahy, Kyle McDonell, Jason Phang, Michael Pieler, USVSN Sai Prashanth, Shivanshu Purohit, Laria Reynolds, Jonathan Tow, Ben Wang, Samuel Weinbach
1. **[GPT-2](https://huggingface.co/docs/transformers/model_doc/gpt2)** (from OpenAI) released with the paper [Language Models are Unsupervised Multitask Learners](https://blog.openai.com/better-language-models/) by Alec Radford*, Jeffrey Wu*, Rewon Child, David Luan, Dario Amodei** and Ilya Sutskever**.
1. **[GPT-J](https://huggingface.co/docs/transformers/model_doc/gptj)** (from EleutherAI) released in the repository [kingoflolz/mesh-transformer-jax](https://github.com/kingoflolz/mesh-transformer-jax/) by Ben Wang and Aran Komatsuzaki.
1. **[GPTBigCode](https://huggingface.co/docs/transformers/model_doc/gpt_bigcode)** (from BigCode) released with the paper [SantaCoder: don't reach for the stars!](https://arxiv.org/abs/2301.03988) by Loubna Ben Allal, Raymond Li, Denis Kocetkov, Chenghao Mou, Christopher Akiki, Carlos Munoz Ferrandis, Niklas Muennighoff, Mayank Mishra, Alex Gu, Manan Dey, Logesh Kumar Umapathi, Carolyn Jane Anderson, Yangtian Zi, Joel Lamy Poirier, Hailey Schoelkopf, Sergey Troshin, Dmitry Abulkhanov, Manuel Romero, Michael Lappert, Francesco De Toni, Bernardo García del Río, Qian Liu, Shamik Bose, Urvashi Bhattacharyya, Terry Yue Zhuo, Ian Yu, Paulo Villegas, Marco Zocca, Sourab Mangrulkar, David Lansky, Huu Nguyen, Danish Contractor, Luis Villa, Jia Li, Dzmitry Bahdanau, Yacine Jernite, Sean Hughes, Daniel Fried, Arjun Guha, Harm de Vries, Leandro von Werra.
1. **[HerBERT](https://huggingface.co/docs/transformers/model_doc/herbert)** (from Allegro.pl, AGH University of Science and Technology) released with the paper [KLEJ: Comprehensive Benchmark for Polish Language Understanding](https://www.aclweb.org/anthology/2020.acl-main.111.pdf) by Piotr Rybak, Robert Mroczkowski, Janusz Tracz, Ireneusz Gawlik.
1. **[Hubert](https://huggingface.co/docs/transformers/model_doc/hubert)** (from Facebook) released with the paper [HuBERT: Self-Supervised Speech Representation Learning by Masked Prediction of Hidden Units](https://arxiv.org/abs/2106.07447) by Wei-Ning Hsu, Benjamin Bolte, Yao-Hung Hubert Tsai, Kushal Lakhotia, Ruslan Salakhutdinov, Abdelrahman Mohamed.
1. **[LongT5](https://huggingface.co/docs/transformers/model_doc/longt5)** (from Google AI) released with the paper [LongT5: Efficient Text-To-Text Transformer for Long Sequences](https://arxiv.org/abs/2112.07916) by Mandy Guo, Joshua Ainslie, David Uthus, Santiago Ontanon, Jianmo Ni, Yun-Hsuan Sung, Yinfei Yang.
1. **[LLaMA](https://huggingface.co/docs/transformers/model_doc/llama)** (from The FAIR team of Meta AI) released with the paper [LLaMA: Open and Efficient Foundation Language Models](https://arxiv.org/abs/2302.13971) by Hugo Touvron, Thibaut Lavril, Gautier Izacard, Xavier Martinet, Marie-Anne Lachaux, Timothée Lacroix, Baptiste Rozière, Naman Goyal, Eric Hambro, Faisal Azhar, Aurelien Rodriguez, Armand Joulin, Edouard Grave, Guillaume Lample.
1. **[Llama2](https://huggingface.co/docs/transformers/model_doc/llama2)** (from The FAIR team of Meta AI) released with the paper [Llama2: Open Foundation and Fine-Tuned Chat Models](https://ai.meta.com/research/publications/llama-2-open-foundation-and-fine-tuned-chat-models/XXX) by Hugo Touvron, Louis Martin, Kevin Stone, Peter Albert, Amjad Almahairi, Yasmine Babaei, Nikolay Bashlykov, Soumya Batra, Prajjwal Bhargava, Shruti Bhosale, Dan Bikel, Lukas Blecher, Cristian Canton Ferrer, Moya Chen, Guillem Cucurull, David Esiobu, Jude Fernandes, Jeremy Fu, Wenyin Fu, Brian Fuller, Cynthia Gao, Vedanuj Goswami, Naman Goyal, Anthony Hartshorn, Saghar Hosseini, Rui Hou, Hakan Inan, Marcin Kardas, Viktor Kerkez Madian Khabsa, Isabel Kloumann, Artem Korenev, Punit Singh Koura, Marie-Anne Lachaux, Thibaut Lavril, Jenya Lee, Diana Liskovich, Yinghai Lu, Yuning Mao, Xavier Martinet, Todor Mihaylov, Pushka rMishra, Igor Molybog, Yixin Nie, Andrew Poulton, Jeremy Reizenstein, Rashi Rungta, Kalyan Saladi, Alan Schelten, Ruan Silva, Eric Michael Smith, Ranjan Subramanian, Xiaoqing EllenTan, Binh Tang, Ross Taylor, Adina Williams, Jian Xiang Kuan, Puxin Xu, Zheng Yan, Iliyan Zarov, Yuchen Zhang, Angela Fan, Melanie Kambadur, Sharan Narang, Aurelien Rodriguez, Robert Stojnic, Sergey Edunov, Thomas Scialom.
1. **[M2M100](https://huggingface.co/docs/transformers/model_doc/m2m_100)** (from Facebook) released with the paper [Beyond English-Centric Multilingual Machine Translation](https://arxiv.org/abs/2010.11125) by Angela Fan, Shruti Bhosale, Holger Schwenk, Zhiyi Ma, Ahmed El-Kishky, Siddharth Goyal, Mandeep Baines, Onur Celebi, Guillaume Wenzek, Vishrav Chaudhary, Naman Goyal, Tom Birch, Vitaliy Liptchinsky, Sergey Edunov, Edouard Grave, Michael Auli, Armand Joulin.
1. **[MarianMT](https://huggingface.co/docs/transformers/model_doc/marian)** Machine translation models trained using [OPUS](http://opus.nlpl.eu/) data by Jörg Tiedemann. The [Marian Framework](https://marian-nmt.github.io/) is being developed by the Microsoft Translator Team.
1. **[mBART](https://huggingface.co/docs/transformers/model_doc/mbart)** (from Facebook) released with the paper [Multilingual Denoising Pre-training for Neural Machine Translation](https://arxiv.org/abs/2001.08210) by Yinhan Liu, Jiatao Gu, Naman Goyal, Xian Li, Sergey Edunov, Marjan Ghazvininejad, Mike Lewis, Luke Zettlemoyer.
1. **[mBART-50](https://huggingface.co/docs/transformers/model_doc/mbart)** (from Facebook) released with the paper [Multilingual Translation with Extensible Multilingual Pretraining and Finetuning](https://arxiv.org/abs/2008.00401) by Yuqing Tang, Chau Tran, Xian Li, Peng-Jen Chen, Naman Goyal, Vishrav Chaudhary, Jiatao Gu, Angela Fan.
1. **[Mistral](https://huggingface.co/docs/transformers/model_doc/mistral)** (from Mistral AI) by The [Mistral AI](https://mistral.ai) team: Albert Jiang, Alexandre Sablayrolles, Arthur Mensch, Chris Bamford, Devendra Singh Chaplot, Diego de las Casas, Florian Bressand, Gianna Lengyel, Guillaume Lample, Lélio Renard Lavaud, Lucile Saulnier, Marie-Anne Lachaux, Pierre Stock, Teven Le Scao, Thibaut Lavril, Thomas Wang, Timothée Lacroix, William El Sayed.
1. **[MMS](https://huggingface.co/docs/transformers/model_doc/mms)** (from Facebook) released with the paper [Scaling Speech Technology to 1,000+ Languages](https://arxiv.org/abs/2305.13516) by Vineel Pratap, Andros Tjandra, Bowen Shi, Paden Tomasello, Arun Babu, Sayani Kundu, Ali Elkahky, Zhaoheng Ni, Apoorv Vyas, Maryam Fazel-Zarandi, Alexei Baevski, Yossi Adi, Xiaohui Zhang, Wei-Ning Hsu, Alexis Conneau, Michael Auli.
1. **[MobileBERT](https://huggingface.co/docs/transformers/model_doc/mobilebert)** (from CMU/Google Brain) released with the paper [MobileBERT: a Compact Task-Agnostic BERT for Resource-Limited Devices](https://arxiv.org/abs/2004.02984) by Zhiqing Sun, Hongkun Yu, Xiaodan Song, Renjie Liu, Yiming Yang, and Denny Zhou.
1. **[MobileViT](https://huggingface.co/docs/transformers/model_doc/mobilevit)** (from Apple) released with the paper [MobileViT: Light-weight, General-purpose, and Mobile-friendly Vision Transformer](https://arxiv.org/abs/2110.02178) by Sachin Mehta and Mohammad Rastegari.
1. **[MPNet](https://huggingface.co/docs/transformers/model_doc/mpnet)** (from Microsoft Research) released with the paper [MPNet: Masked and Permuted Pre-training for Language Understanding](https://arxiv.org/abs/2004.09297) by Kaitao Song, Xu Tan, Tao Qin, Jianfeng Lu, Tie-Yan Liu.
1. **[MPT](https://huggingface.co/docs/transformers/model_doc/mpt)** (from MosaiML) released with the repository [llm-foundry](https://github.com/mosaicml/llm-foundry/) by the MosaicML NLP Team.
1. **[MT5](https://huggingface.co/docs/transformers/model_doc/mt5)** (from Google AI) released with the paper [mT5: A massively multilingual pre-trained text-to-text transformer](https://arxiv.org/abs/2010.11934) by Linting Xue, Noah Constant, Adam Roberts, Mihir Kale, Rami Al-Rfou, Aditya Siddhant, Aditya Barua, Colin Raffel.
1. **[NLLB](https://huggingface.co/docs/transformers/model_doc/nllb)** (from Meta) released with the paper [No Language Left Behind: Scaling Human-Centered Machine Translation](https://arxiv.org/abs/2207.04672) by the NLLB team.
1. **[Nougat](https://huggingface.co/docs/transformers/model_doc/nougat)** (from Meta AI) released with the paper [Nougat: Neural Optical Understanding for Academic Documents](https://arxiv.org/abs/2308.13418) by Lukas Blecher, Guillem Cucurull, Thomas Scialom, Robert Stojnic.
1. **[OPT](https://huggingface.co/docs/transformers/master/model_doc/opt)** (from Meta AI) released with the paper [OPT: Open Pre-trained Transformer Language Models](https://arxiv.org/abs/2205.01068) by Susan Zhang, Stephen Roller, Naman Goyal, Mikel Artetxe, Moya Chen, Shuohui Chen et al.
1. **[OWL-ViT](https://huggingface.co/docs/transformers/model_doc/owlvit)** (from Google AI) released with the paper [Simple Open-Vocabulary Object Detection with Vision Transformers](https://arxiv.org/abs/2205.06230) by Matthias Minderer, Alexey Gritsenko, Austin Stone, Maxim Neumann, Dirk Weissenborn, Alexey Dosovitskiy, Aravindh Mahendran, Anurag Arnab, Mostafa Dehghani, Zhuoran Shen, Xiao Wang, Xiaohua Zhai, Thomas Kipf, and Neil Houlsby.
1. **[Phi](https://huggingface.co/docs/transformers/main/model_doc/phi)** (from Microsoft) released with the papers - [Textbooks Are All You Need](https://arxiv.org/abs/2306.11644) by Suriya Gunasekar, Yi Zhang, Jyoti Aneja, Caio César Teodoro Mendes, Allie Del Giorno, Sivakanth Gopi, Mojan Javaheripi, Piero Kauffmann, Gustavo de Rosa, Olli Saarikivi, Adil Salim, Shital Shah, Harkirat Singh Behl, Xin Wang, Sébastien Bubeck, Ronen Eldan, Adam Tauman Kalai, Yin Tat Lee and Yuanzhi Li, [Textbooks Are All You Need II: phi-1.5 technical report](https://arxiv.org/abs/2309.05463) by Yuanzhi Li, Sébastien Bubeck, Ronen Eldan, Allie Del Giorno, Suriya Gunasekar and Yin Tat Lee.
1. **[ResNet](https://huggingface.co/docs/transformers/model_doc/resnet)** (from Microsoft Research) released with the paper [Deep Residual Learning for Image Recognition](https://arxiv.org/abs/1512.03385) by Kaiming He, Xiangyu Zhang, Shaoqing Ren, Jian Sun.
1. **[RoBERTa](https://huggingface.co/docs/transformers/model_doc/roberta)** (from Facebook), released together with the paper [RoBERTa: A Robustly Optimized BERT Pretraining Approach](https://arxiv.org/abs/1907.11692) by Yinhan Liu, Myle Ott, Naman Goyal, Jingfei Du, Mandar Joshi, Danqi Chen, Omer Levy, Mike Lewis, Luke Zettlemoyer, Veselin Stoyanov.
1. **[RoFormer](https://huggingface.co/docs/transformers/model_doc/roformer)** (from ZhuiyiTechnology), released together with the paper [RoFormer: Enhanced Transformer with Rotary Position Embedding](https://arxiv.org/abs/2104.09864) by Jianlin Su and Yu Lu and Shengfeng Pan and Bo Wen and Yunfeng Liu.
1. **[SegFormer](https://huggingface.co/docs/transformers/model_doc/segformer)** (from NVIDIA) released with the paper [SegFormer: Simple and Efficient Design for Semantic Segmentation with Transformers](https://arxiv.org/abs/2105.15203) by Enze Xie, Wenhai Wang, Zhiding Yu, Anima Anandkumar, Jose M. Alvarez, Ping Luo.
1. **[Segment Anything](https://huggingface.co/docs/transformers/model_doc/sam)** (from Meta AI) released with the paper [Segment Anything](https://arxiv.org/pdf/2304.02643v1.pdf) by Alexander Kirillov, Eric Mintun, Nikhila Ravi, Hanzi Mao, Chloe Rolland, Laura Gustafson, Tete Xiao, Spencer Whitehead, Alex Berg, Wan-Yen Lo, Piotr Dollar, Ross Girshick.
1. **[SigLIP](https://huggingface.co/docs/transformers/main/model_doc/siglip)** (from Google AI) released with the paper [Sigmoid Loss for Language Image Pre-Training](https://arxiv.org/abs/2303.15343) by Xiaohua Zhai, Basil Mustafa, Alexander Kolesnikov, Lucas Beyer.
1. **[SpeechT5](https://huggingface.co/docs/transformers/model_doc/speecht5)** (from Microsoft Research) released with the paper [SpeechT5: Unified-Modal Encoder-Decoder Pre-Training for Spoken Language Processing](https://arxiv.org/abs/2110.07205) by Junyi Ao, Rui Wang, Long Zhou, Chengyi Wang, Shuo Ren, Yu Wu, Shujie Liu, Tom Ko, Qing Li, Yu Zhang, Zhihua Wei, Yao Qian, Jinyu Li, Furu Wei.
1. **[SqueezeBERT](https://huggingface.co/docs/transformers/model_doc/squeezebert)** (from Berkeley) released with the paper [SqueezeBERT: What can computer vision teach NLP about efficient neural networks?](https://arxiv.org/abs/2006.11316) by Forrest N. Iandola, Albert E. Shaw, Ravi Krishna, and Kurt W. Keutzer.
1. **[Swin Transformer](https://huggingface.co/docs/transformers/model_doc/swin)** (from Microsoft) released with the paper [Swin Transformer: Hierarchical Vision Transformer using Shifted Windows](https://arxiv.org/abs/2103.14030) by Ze Liu, Yutong Lin, Yue Cao, Han Hu, Yixuan Wei, Zheng Zhang, Stephen Lin, Baining Guo.
1. **[Swin2SR](https://huggingface.co/docs/transformers/model_doc/swin2sr)** (from University of Würzburg) released with the paper [Swin2SR: SwinV2 Transformer for Compressed Image Super-Resolution and Restoration](https://arxiv.org/abs/2209.11345) by Marcos V. Conde, Ui-Jin Choi, Maxime Burchi, Radu Timofte.
1. **[T5](https://huggingface.co/docs/transformers/model_doc/t5)** (from Google AI) released with the paper [Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](https://arxiv.org/abs/1910.10683) by Colin Raffel and Noam Shazeer and Adam Roberts and Katherine Lee and Sharan Narang and Michael Matena and Yanqi Zhou and Wei Li and Peter J. Liu.
1. **[T5v1.1](https://huggingface.co/docs/transformers/model_doc/t5v1.1)** (from Google AI) released in the repository [google-research/text-to-text-transfer-transformer](https://github.com/google-research/text-to-text-transfer-transformer/blob/main/released_checkpoints.md#t511) by Colin Raffel and Noam Shazeer and Adam Roberts and Katherine Lee and Sharan Narang and Michael Matena and Yanqi Zhou and Wei Li and Peter J. Liu.
1. **[Table Transformer](https://huggingface.co/docs/transformers/model_doc/table-transformer)** (from Microsoft Research) released with the paper [PubTables-1M: Towards Comprehensive Table Extraction From Unstructured Documents](https://arxiv.org/abs/2110.00061) by Brandon Smock, Rohith Pesala, Robin Abraham.
1. **[TrOCR](https://huggingface.co/docs/transformers/model_doc/trocr)** (from Microsoft), released together with the paper [TrOCR: Transformer-based Optical Character Recognition with Pre-trained Models](https://arxiv.org/abs/2109.10282) by Minghao Li, Tengchao Lv, Lei Cui, Yijuan Lu, Dinei Florencio, Cha Zhang, Zhoujun Li, Furu Wei.
1. **[Vision Transformer (ViT)](https://huggingface.co/docs/transformers/model_doc/vit)** (from Google AI) released with the paper [An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale](https://arxiv.org/abs/2010.11929) by Alexey Dosovitskiy, Lucas Beyer, Alexander Kolesnikov, Dirk Weissenborn, Xiaohua Zhai, Thomas Unterthiner, Mostafa Dehghani, Matthias Minderer, Georg Heigold, Sylvain Gelly, Jakob Uszkoreit, Neil Houlsby.
1. **[ViTMatte](https://huggingface.co/docs/transformers/model_doc/vitmatte)** (from HUST-VL) released with the paper [ViTMatte: Boosting Image Matting with Pretrained Plain Vision Transformers](https://arxiv.org/abs/2305.15272) by Jingfeng Yao, Xinggang Wang, Shusheng Yang, Baoyuan Wang.
1. **[VITS](https://huggingface.co/docs/transformers/model_doc/vits)** (from Kakao Enterprise) released with the paper [Conditional Variational Autoencoder with Adversarial Learning for End-to-End Text-to-Speech](https://arxiv.org/abs/2106.06103) by Jaehyeon Kim, Jungil Kong, Juhee Son.
1. **[Wav2Vec2](https://huggingface.co/docs/transformers/model_doc/wav2vec2)** (from Facebook AI) released with the paper [wav2vec 2.0: A Framework for Self-Supervised Learning of Speech Representations](https://arxiv.org/abs/2006.11477) by Alexei Baevski, Henry Zhou, Abdelrahman Mohamed, Michael Auli.
1. **[WavLM](https://huggingface.co/docs/transformers/model_doc/wavlm)** (from Microsoft Research) released with the paper [WavLM: Large-Scale Self-Supervised Pre-Training for Full Stack Speech Processing](https://arxiv.org/abs/2110.13900) by Sanyuan Chen, Chengyi Wang, Zhengyang Chen, Yu Wu, Shujie Liu, Zhuo Chen, Jinyu Li, Naoyuki Kanda, Takuya Yoshioka, Xiong Xiao, Jian Wu, Long Zhou, Shuo Ren, Yanmin Qian, Yao Qian, Jian Wu, Michael Zeng, Furu Wei.
1. **[Whisper](https://huggingface.co/docs/transformers/model_doc/whisper)** (from OpenAI) released with the paper [Robust Speech Recognition via Large-Scale Weak Supervision](https://cdn.openai.com/papers/whisper.pdf) by Alec Radford, Jong Wook Kim, Tao Xu, Greg Brockman, Christine McLeavey, Ilya Sutskever.
1. **[XLM](https://huggingface.co/docs/transformers/model_doc/xlm)** (from Facebook) released together with the paper [Cross-lingual Language Model Pretraining](https://arxiv.org/abs/1901.07291) by Guillaume Lample and Alexis Conneau.
1. **[XLM-RoBERTa](https://huggingface.co/docs/transformers/model_doc/xlm-roberta)** (from Facebook AI), released together with the paper [Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116) by Alexis Conneau*, Kartikay Khandelwal*, Naman Goyal, Vishrav Chaudhary, Guillaume Wenzek, Francisco Guzmán, Edouard Grave, Myle Ott, Luke Zettlemoyer and Veselin Stoyanov.
1. **[YOLOS](https://huggingface.co/docs/transformers/model_doc/yolos)** (from Huazhong University of Science & Technology) released with the paper [You Only Look at One Sequence: Rethinking Transformer in Vision through Object Detection](https://arxiv.org/abs/2106.00666) by Yuxin Fang, Bencheng Liao, Xinggang Wang, Jiemin Fang, Jiyang Qi, Rui Wu, Jianwei Niu, Wenyu Liu.
