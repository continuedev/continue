import path from "path";
import {
  AutomaticSpeechRecognitionPipeline,
  env,
  pipeline,
} from "../vendor/modules/@xenova/transformers";
import { parentPort, workerData } from "node:worker_threads";

const config = workerData;

// Ensure only 1 instance of whisper per worker
export class WhisperPipeline {
  static instance: AutomaticSpeechRecognitionPipeline | null = null;

  static async getInstance() {
    if (WhisperPipeline.instance === null) {
      // TODO: enable user to set custom models in configuration then download + cache them in the background as necessary
      // if(config.model !== "base...") {
      //   modelDir = "~/.continue/models/whisper/..."
      // }

      // TODO: add gpu support; either through transformers.js, WASM, whisper.cpp, onnxruntime, etc

      // Configure transformersjs to use locally cached model
      env.allowLocalModels = true;
      env.allowRemoteModels = false;
      env.localModelPath = path.join(
        typeof __dirname === "undefined"
          ? // @ts-ignore
            path.dirname(new URL(import.meta.url).pathname)
          : __dirname,
        "..",
        "models",
      );

      WhisperPipeline.instance = await pipeline(
        "automatic-speech-recognition",
        config.model,
        {
          quantized: true,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          progress_callback: (p: any) => {
            if (
              p.status === "ready" &&
              p.task === "automatic-speech-recognition"
            ) {
              parentPort?.postMessage({
                type: "whisperReady",
              });
            }
          },
        },
      );
    }

    return WhisperPipeline.instance;
  }
}

class VoiceInputWorker {
  static whisper: AutomaticSpeechRecognitionPipeline;

  static async setup() {
    VoiceInputWorker.whisper = await WhisperPipeline.getInstance();

    parentPort?.on("message", async (message) => {
      const { audioData, isFinal } = message;

      if (!VoiceInputWorker.whisper) {
        console.warn("Whisper model not loaded.");
        return;
      }

      // Perform transcription
      const result = await VoiceInputWorker.whisper(audioData);

      if ("text" in result) {
        parentPort?.postMessage({
          type: "newSpeechFromText",
          data: {
            isFinal,
            text: result.text
              .replace(/\[.*\]/, "") // Remove non-speech outputs [Silence], [inaudible], etc...
              .replace(/^ you$/, "") // Noise sometimes get's picked up as 'you'
              .trim(),
          },
        });
      }
    });
  }
}

VoiceInputWorker.setup();
