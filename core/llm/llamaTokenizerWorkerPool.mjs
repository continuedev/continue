import workerpool from "workerpool";
import llamaTokenizer from "./llamaTokenizer.mjs";

function encode(segment) {
    return llamaTokenizer.encode(segment);
}

workerpool.worker({
    encode,
});