import os from "node:os";
import path from "path";
import { Writable } from "node:stream";
import { Worker } from "node:worker_threads";
import type { IMessenger } from "./messenger";
import type { FromCoreProtocol, ToCoreProtocol } from "../protocol";
import fs from "fs";

import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
ffmpeg.setFfmpegPath(ffmpegPath.path);

import * as ort from "onnxruntime-node";
import { PlatformAgnosticNonRealTimeVAD } from "@ricky0123/vad-node/dist/_common";
import { NonRealTimeVADOptions } from "@ricky0123/vad-node";

// Manually load onnx from our node_modules folder
const vadModelFetcher = async (): Promise<ArrayBuffer> => {
  const contents = fs.readFileSync(
    `${__dirname}/node_modules/@ricky0123/vad-node/dist/silero_vad.onnx`,
  );
  return contents.buffer;
};

class NonRealTimeVAD extends PlatformAgnosticNonRealTimeVAD {
  static async new(
    options: Partial<NonRealTimeVADOptions> = {},
  ): Promise<NonRealTimeVAD> {
    return await this._new(vadModelFetcher, ort, options);
  }
}

const sampleRate: number = 16000;
const channels: number = 1;
const bytesPerSample: number = 4; // Float32 is 4 bytes
const vadFrameSamples: number = 1536; // default frame size for silero-vad

// Seconds of padding to keep at the beginning of an utterance
const preSpeechPadAmount: number = 0.5;

// Set the minimum length of audio before processing & the minimum amount of time from the end of a recording before processing
const minSpeechLength: number = 0.5;

// Minimum window of speech audio to parse; if user is still speaking we'll parse multiple windows at once for better whisper output
const speechWindow: number = 1.5;

// Threshold time in seconds that we'll consider our user to still be speaking if speech is detected within this threshold of the end of the window
const doneSpeakingThreshold: number = 1;

// Amount of time in seconds after receiving no speech before we should stop voice input
const noVoiceInputTimeout: number = 10;

let audioData: Float32Array = new Float32Array();
let isProcessing: boolean = false;
let timeSinceSpeech: number = 0;
let lastMark: number = 0;

export class VoiceInput {
  static os: string | undefined = undefined;
  static messenger: IMessenger<ToCoreProtocol, FromCoreProtocol>;

  static vad: NonRealTimeVAD;
  static command: ffmpeg.FfmpegCommand | undefined = undefined;

  static whisperIsLoaded: boolean = false;
  static whisperWorker: Worker;

  static stream: Writable;

  static async start() {
    if (!VoiceInput.whisperIsLoaded) {
      throw new Error("Voice Input is not ready.");
    }

    VoiceInput.captureAudio();
  }

  static async stop() {
    VoiceInput.command?.kill("");
    VoiceInput.messenger.request("setVoiceInputIsActive", false);
  }

  private static captureAudio() {
    // Return if we're already processing audio
    if (VoiceInput.command) {
      return;
    }

    let audioInput: string;
    let inputFormat: string;

    switch (VoiceInput.os) {
      case "win32":
        audioInput = "audio=Microphone";
        inputFormat = "dshow";
        break;
      case "darwin":
        audioInput = ":0";
        inputFormat = "avfoundation";
        break;
      case "linux":
        audioInput = "default";
        inputFormat = "alsa";
        break;
      default:
        audioInput = ":0";
        inputFormat = "avfoundation";
    }

    VoiceInput.command = ffmpeg()
      .input(audioInput)
      .inputFormat(inputFormat)
      .audioFrequency(sampleRate)
      .audioChannels(channels)
      .format("f32le")
      .audioCodec("pcm_f32le")
      .on("start", () => {
        console.log("FFmpeg process started");
      })
      .on("error", (err: Error) => {
        if (err.message.indexOf("killed with signal") > -1) {
          console.log("FFmpeg process ended");
        } else {
          console.warn("FFmpeg error:", err);
        }

        VoiceInput.command = undefined;
        // TODO: parse(...) final bit of audio
        audioData = new Float32Array();
        VoiceInput.messenger.request("setVoiceInputIsActive", false);
        isProcessing = false;
      })
      .on("end", () => {
        console.log("FFmpeg process ended");
        
        VoiceInput.command = undefined;
        // TODO: parse(...) final bit of audio
        audioData = new Float32Array();
        VoiceInput.messenger.request("setVoiceInputIsActive", false);
        isProcessing = false;
      });

    // Pipe our ffmpeg microphone input to our audio processing pipeline including VAD & Whisper STT
    VoiceInput.stream = VoiceInput.command.pipe();
    VoiceInput.stream.on("data", (chunk: Buffer) => {
      const float32Array: Float32Array = new Float32Array(
        chunk.buffer,
        chunk.byteOffset,
        chunk.length / bytesPerSample,
      );
      VoiceInput.processAudioChunk(float32Array);
    });

    // Notify the GUI we're recording
    VoiceInput.messenger.request("setVoiceInputIsActive", true);
  }

  private static async processAudioChunk(
    float32Array: Float32Array,
  ): Promise<void> {
    // Concatenate the new chunk with existing audio data
    const newAudioData = new Float32Array(
      audioData.length + float32Array.length,
    );
    newAudioData.set(audioData);
    newAudioData.set(float32Array, audioData.length);
    audioData = newAudioData;

    // Require the minimum speech length before processing
    if (audioData.length / sampleRate < minSpeechLength) {
      return;
    }

    // Only process one chunk at a time
    if (!isProcessing) {
      isProcessing = true;

      VoiceInput.stream.cork();
      await VoiceInput.processVoiceSegments();
    }
  }

  private static async processVoiceSegments(): Promise<void> {
    // Require a minimum of 1 speech window before processing // TODO: consolidate with processAudioChunk check before isProcessing
    if (audioData.length / sampleRate - lastMark < speechWindow) {
      isProcessing = false;
      VoiceInput.stream.uncork();
      return;
    }

    const localCopy: Float32Array = new Float32Array(audioData);

    // Run our voice activity detector (silero-vad) to determine if the user is still speaking at the end of the current speech window
    const vadResult = VoiceInput.vad.run(localCopy, sampleRate);

    // Track the end of the last voice detection
    let voiceEnd: number = 0;

    for await (const { audio, start, end } of vadResult) {
      // Track when / if the user has spoken during this speech window
      if (end > lastMark) {
        voiceEnd =
          Math.floor(end / 1000) > voiceEnd ? Math.floor(end / 1000) : voiceEnd;
      }
    }

    // If the user has spoken during this segment and they did not finish speaking within our threshold of the end of
    // this window then temporarily parse the audio but do not clear it from audioData
    if (voiceEnd >= audioData.length / sampleRate - doneSpeakingThreshold) {
      await VoiceInput.parse(localCopy);
      lastMark = audioData.length / sampleRate;

      timeSinceSpeech = (audioData.length / sampleRate) - voiceEnd;
    } else {
      // The user has finished speaking; parse one last time and commit it as final to the frontend
      await VoiceInput.parse(localCopy, true);
      
      timeSinceSpeech += speechWindow;

      // Check if we've passed our noVoiceInputTimeout
      if(timeSinceSpeech >= noVoiceInputTimeout) {
        VoiceInput.stop();
        return;
      }

      // Clear this processed audioData
      audioData = audioData.slice(
        lastMark * sampleRate + speechWindow * sampleRate,
      );

      lastMark = 0;
    }

    VoiceInput.stream.uncork();
  }

  private static async parse(
    audioData: Float32Array,
    isFinal: boolean = false,
  ) {
    VoiceInput.whisperWorker.postMessage({
      audioData,
      isFinal,
    });
  }

  static async setup() {
    VoiceInput.os = os.platform();

    // Update silero-vad's default configuration to reduce the minSpeechFrames & increase the pre-speech padding
    const vadOptions: Partial<NonRealTimeVADOptions> = {
      minSpeechFrames: 2,
      preSpeechPadFrames: preSpeechPadAmount * (sampleRate / vadFrameSamples),
    };

    VoiceInput.vad = await NonRealTimeVAD.new(vadOptions);

    // Setup our worker to background process audio data with whisper
    VoiceInput.whisperWorker = new Worker(
      path.resolve(__dirname, "voiceInputWorker.js"),
      {
        workerData: {
          model: "whisper-tiny.en", // TODO: allow user to choose different models (ex: "distil-small.en")
        },
      },
    );

    VoiceInput.whisperWorker.on("message", (message) => {
      if (message.type === "newSpeechFromText") {
        console.log("Transcribed speech:", message.data);

        this.messenger?.send("newSpeechFromText", message.data);

        isProcessing = false;
      } else if (message.type === "whisperReady") {
        // Let the UI know we're ready to begin processing speech input
        VoiceInput.whisperIsLoaded = true;
        VoiceInput.messenger?.send("voiceInputReady", true);
      }
    });
  }
}
