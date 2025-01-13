import { createAsyncThunk } from "@reduxjs/toolkit";
import { ThunkApiType } from "../store";
import PiperTTSClient from "../util/piperTTS";

export const PiperTTS = createAsyncThunk<void, {lang:string,message:string,flush:boolean}, ThunkApiType>(
  "PiperTTS",
  async (payload, { dispatch, extra, getState }) => {
    const state = getState();
    try {      
        const voice=await PiperTTSClient.findVoice(payload.lang);  
        if (voice){
            if(voice && voice.key){
                if(payload.flush && voice?.storedSize>1){
                    await PiperTTSClient.flush();
                }
                const client = new PiperTTSClient({ voiceId:voice.key },dispatch);
                
        
                const blobUrl = await client.getAudioBlobForText(payload.message);                
                PiperTTSClient.audio.src=blobUrl;
                PiperTTSClient.audio.play();
        
         
            }
        }else{
            throw new Error("Could not fetch voices from web worker.");
        }
    }catch(e){
        console.error(e);
    }
    
  },
);
