import { LLMOptions } from "../../index.js";
import OpenAI from "./OpenAI.js";

class N1N extends OpenAI {
    static providerName = "n1n";
    static defaultOptions: Partial<LLMOptions> = {
        apiBase: "https://api.n1n.ai/v1/",
    };
}

export default N1N;
