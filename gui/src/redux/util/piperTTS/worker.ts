import * as TTS from "@mintplex-labs/piper-tts-web";
import { ExtendedVoice } from ".";

/** @type {import("@mintplexlabs/piper-web-tts").TtsSession | null} */
let PIPER_SESSION = null;

/**
 * @typedef PredictionRequest
 * @property {('init')} type
 * @property {string} text - the text to inference on
 * @property {import('@mintplexlabs/piper-web-tts').VoiceId} voiceId - the voiceID key to use.
 * @property {string|null} baseUrl - the base URL to fetch WASMs from.
 */
/**
 * @typedef PredictionRequestResponse
 * @property {('result')} type
 * @property {Blob} audio - the text to inference on
 */

/**
 * @typedef VoicesRequest
 * @property {('voices')} type
 * @property {string|null} baseUrl - the base URL to fetch WASMs from.
 */
/**
 * @typedef VoicesRequestResponse
 * @property {('voices')} type
 * @property {[import("@mintplex-labs/piper-tts-web/dist/types")['Voice']]} voices - available voices in array
 */

/**
 * @typedef FlushRequest
 * @property {('flush')} type
 */
/**
 * @typedef FlushRequestResponse
 * @property {('flush')} type
 * @property {true} flushed
 */

/**
 * Web worker for generating client-side PiperTTS predictions
 * @param {MessageEvent<PredictionRequest | VoicesRequest | FlushRequest>} event - The event object containing the prediction request
 * @returns {Promise<PredictionRequestResponse|VoicesRequestResponse|FlushRequestResponse>}
 */
async function main(event) {
  if (event.data.type === "voice") {
    const lang=event.data.lang;
    const stored = await TTS.stored();
    const voiceKey=stored.find(voice => {
      const _voice = voice.replace(/[_]/g, '-');
      return _voice.includes(lang);
    });
    if(voiceKey){
      return {key:voiceKey,storedSize:stored.length}
    }
    const voices = await TTS.voices();
    voices.forEach((voice:ExtendedVoice) => (voice.is_stored = stored.includes(voice.key)));
    const voice:ExtendedVoice|{key:TTS.VoiceId,storedSize?:number}=voices.find(_voice=>_voice.key.replace(/[_]/g, '-').includes(lang)) ?? {key:stored[0]};
    if(voice){
      voice.storedSize=stored.length;
      self.postMessage({ type: "voice", voice });
    }else{
      self.postMessage({ type: "voice", voice:null });
    }

    return;
  }

  if (event.data.type === "flush") {
    await TTS.flush();
    self.postMessage({ type: "flush", flushed: true });
    return;
  }

  if (event.data?.type !== "init") return;
  if (!PIPER_SESSION) {
    PIPER_SESSION = new TTS.TtsSession({
      voiceId: event.data.voiceId,
      progress: (e) => self.postMessage(JSON.stringify(e)),
      logger: (msg) => self.postMessage(msg),
      ...(!!event.data.baseUrl
        ? {
            wasmPaths: {
              onnxWasm: `${event.data.baseUrl}/piper/ort/`,
              piperData: `${event.data.baseUrl}/piper/piper_phonemize.data`,
              piperWasm: `${event.data.baseUrl}/piper/piper_phonemize.wasm`,
            },
          }
        : {}),
    });
  }

  if (event.data.voiceId && PIPER_SESSION.voiceId !== event.data.voiceId)
    PIPER_SESSION.voiceId = event.data.voiceId;

  PIPER_SESSION.predict(event.data.text)
    .then((res) => {
      if (res instanceof Blob) {
        self.postMessage({ type: "result", audio: res });
        return;
      }
    })
    .catch((error) => {
      self.postMessage({ type: "error", message: error.message, error }); // Will be an error.
    });
}

self.addEventListener("message", main);
