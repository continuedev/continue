
import { Voice } from "@mintplex-labs/piper-tts-web";
import { setTTSActive } from "../../slices/uiSlice";
import myWorker from "./worker?worker"
export type ExtendedVoice = {
  is_stored: boolean;
  storedSize?:number; 
} & Voice; 
export default class PiperTTSClient {
  static _instance;
  voiceId = "en_US-hfc_female-medium";
  static worker = null;
  static audio:HTMLAudioElement;
  constructor({ voiceId } = { voiceId: null },dispatch) {
    if (PiperTTSClient._instance) {
      this.voiceId = voiceId !== null ? voiceId : this.voiceId;
      return PiperTTSClient._instance;
    }

    this.voiceId = voiceId !== null ? voiceId : this.voiceId;
    PiperTTSClient.audio=new Audio();
    PiperTTSClient.audio.load();
    PiperTTSClient.audio.onended=()=>{
        dispatch(setTTSActive(false))
    }
    PiperTTSClient.audio.onplay=()=>{        
        dispatch(setTTSActive(true))
    }
    PiperTTSClient._instance = this;
    return this;
  }

  static async getWorker():Promise<Worker> {
    if (!PiperTTSClient.worker){
      const workerSource = window.vscMediaUrl+"/assets/worker.js";
      PiperTTSClient.worker= await fetch(workerSource).then(result => result.blob())
      .then(blob => {
            const blobUrl = URL.createObjectURL(blob)
            return new Worker(blobUrl);
      });
    }
    return PiperTTSClient.worker;
    new myWorker();
  }

  /**
   * Get all available voices for a client
   * @returns {Promise<import("@mintplex-labs/piper-tts-web/dist/types").Voice[]}>}
   */
  static async findVoice(lang:string):Promise<ExtendedVoice> {
    const tmpWorker = await PiperTTSClient.getWorker();
    tmpWorker.postMessage({ type: "voice",lang });
    return new Promise((resolve, reject) => {
      let timeout = null;
      const handleMessage = (event) => {
        if (event.data.type !== "voice") {
          console.log("PiperTTSWorker debug event:", event.data);
          return;
        }
        resolve(event.data.voice);
        tmpWorker.removeEventListener("message", handleMessage);
        timeout && clearTimeout(timeout);
        //tmpWorker.terminate();
      };

      timeout = setTimeout(() => {
        reject("TTS Worker timed out.");
      }, 30_000);
      tmpWorker.addEventListener("message", handleMessage);
    });
  }

  static async flush() {    
    const tmpWorker = await PiperTTSClient.getWorker();
    tmpWorker.postMessage({ type: "flush" });
    return new Promise((resolve, reject) => {
      let timeout = null;
      const handleMessage = (event) => {
        if (event.data.type !== "flush") {
          console.log("PiperTTSWorker debug event:", event.data);
          return;
        }
        resolve(event.data.flushed);
        tmpWorker.removeEventListener("message", handleMessage);
        timeout && clearTimeout(timeout);
        //tmpWorker.terminate();
      };

      timeout = setTimeout(() => {
        reject("TTS Worker timed out.");
      }, 30_000);
      tmpWorker.addEventListener("message", handleMessage);
    });
  }

  /**
   * Runs prediction via webworker so we can get an audio blob back.
   * @returns {Promise<{blobURL: string|null, error: string|null}>} objectURL blob: type.
   */
  async waitForBlobResponse() {   
    return new Promise((resolve) => {
      let timeout = null;
      const handleMessage = (event) => {         
        if (event.data.type === "error") {
          PiperTTSClient.worker.removeEventListener("message", handleMessage);
          timeout && clearTimeout(timeout);
          return resolve({ blobURL: null, error: event.data.message });
        }        
       
        if (event.data.type !== "result") {
          console.log("PiperTTSWorker debug event:", event.data);
          return;
        }     

        resolve({
          blobURL: URL.createObjectURL(event.data.audio),
          error: null,
        });
        PiperTTSClient.worker.removeEventListener("message", handleMessage);
        timeout && clearTimeout(timeout);
      };

      timeout = setTimeout(() => {
        resolve({ blobURL: null, error: "PiperTTSWorker Worker timed out." });
      }, 30_000);
      
      PiperTTSClient.worker.addEventListener("message", handleMessage);
     
    });
  }

  async getAudioBlobForText(textToSpeak, voiceId = null) {
    const primaryWorker = await PiperTTSClient.getWorker()
    primaryWorker.postMessage({
      type: "init",
      text: String(textToSpeak),
      voiceId: voiceId ?? this.voiceId,
      // Don't reference WASM because in the docker image
      // the user will be connected to internet (mostly)
      // and it bloats the app size on the frontend or app significantly
      // and running the docker image fully offline is not an intended use-case unlike the app.
    });
    

    const { blobURL, error }:any = await this.waitForBlobResponse();
    if (!!error) {
      console.error(
        `Could not generate voice prediction. Error: ${error}`,
        "error",
        { clear: true }
      );
      return;
    }

    return blobURL;
  }
}
