import { InputDescriptor } from "./providers";

export const contextLength: InputDescriptor = {
  inputType: "number",
  key: "contextLength",
  label: "Context Length",
  defaultValue: undefined,
  required: false,
};

export const temperature: InputDescriptor = {
  inputType: "number",
  key: "completionOptions.temperature",
  label: "Temperature",
  defaultValue: undefined,
  required: false,
  min: 0.0,
  max: 1.0,
  step: 0.01,
};

export const topP: InputDescriptor = {
  inputType: "number",
  key: "completionOptions.topP",
  label: "Top-P",
  defaultValue: undefined,
  required: false,
  min: 0,
  max: 1,
  step: 0.01,
};

export const topK: InputDescriptor = {
  inputType: "number",
  key: "completionOptions.topK",
  label: "Top-K",
  defaultValue: undefined,
  required: false,
  min: 0,
  step: 1,
};

export const presencePenalty: InputDescriptor = {
  inputType: "number",
  key: "completionOptions.presencePenalty",
  label: "Presence Penalty",
  defaultValue: undefined,
  required: false,
  min: 0,
  max: 1,
  step: 0.01,
};

export const frequencyPenalty: InputDescriptor = {
  inputType: "number",
  key: "completionOptions.frequencyPenalty",
  label: "Frequency Penalty",
  defaultValue: undefined,
  required: false,
  min: 0,
  max: 1,
  step: 0.01,
};
