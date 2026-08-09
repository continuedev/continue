import workerpool from "workerpool";
import { encodingForModel as _encodingForModel } from "js-tiktoken";

const tiktokenEncoding = _encodingForModel("gpt-4");

function encode(text) {
  return tiktokenEncoding.encode(text, "all", []);
}

function decode(tokens) {
  return tiktokenEncoding.decode(tokens);
}

workerpool.worker({
  decode,
  encode,
});
