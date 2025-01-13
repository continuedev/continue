import { createAsyncThunk } from "@reduxjs/toolkit";
import { ThunkApiType } from "../store";
import { setTTSActive,setTTSUtterance } from "../slices/uiSlice";

export const TTSNative = createAsyncThunk<void, {lang:string,message:string}, ThunkApiType>(
  "TTSNative",
  async (payload, { dispatch, extra, getState }) => {
    const state = getState();
    let utterance=state.ui.ttsUtterance;
    if(!(state.ui.ttsUtterance instanceof SpeechSynthesisUtterance)){
      utterance=new SpeechSynthesisUtterance();
      utterance.onend = () => {
        dispatch(setTTSActive(false));     
      }      
    }     
    utterance.text=payload.message;
    const voices=window.speechSynthesis.getVoices();
    utterance.voice=voices.find(voice => voice.name === payload.lang||voice.lang === payload.lang)??voices[0];
    dispatch(setTTSUtterance(utterance));
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    dispatch(setTTSActive(true));  
  },
);
