import workerpool from "workerpool";
import llamaTokenizer from "./llamaTokenizer.mjs";

function encode(segment) {
  return llamaTokenizer.encode(segment);
}

function decode(tokens) {
  return llamaTokenizer.decode(tokens);
}

workerpool.worker({
  decode,
  encode,
});
