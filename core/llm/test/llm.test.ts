// import { LLM } from "..";
// import Anthropic from "../llms/Anthropic";
// import FreeTrial from "../llms/FreeTrial";
// import * as dotenv from "dotenv";
// import { CompletionOptions } from "../types";
// import OpenAI from "../llms/OpenAI";
// import Replicate from "../llms/Replicate";
// import LMStudio from "../llms/LMStudio";
// import Ollama from "../llms/Ollama";
// import {
//   HuggingFaceInferenceAPI,
//   HuggingFaceTGI,
//   LlamaCpp,
//   TextGenWebUI,
//   Together,
// } from "../llms";

// jest.setTimeout(100_000);

// dotenv.config();

// const COMPLETION_OPTIONS: Partial<CompletionOptions> = {
//   temperature: 0.5,
//   topP: 1,
//   topK: 40,
//   presencePenalty: 0,
//   frequencyPenalty: 0,
//   stop: ["\n"],
//   maxTokens: 5,
// };

// function testLLM(llm: LLM) {
//   beforeAll(() => {
//     llm.completionOptions = { ...llm.completionOptions, ...COMPLETION_OPTIONS };
//   });

//   describe(llm.providerName, () => {
//     test("Stream Chat works", async () => {
//       let total = "";
//       for await (const chunk of llm.streamChat([
//         { role: "user", content: "Hello" },
//       ])) {
//         total += chunk.content;
//       }

//       expect(total.length).toBeGreaterThan(0);
//       console.log(total);
//       return;
//     });

//     test("Stream Complete works", async () => {
//       let total = "";
//       for await (const chunk of llm.streamComplete("Hello")) {
//         total += chunk;
//       }

//       expect(total.length).toBeGreaterThan(0);
//       console.log(total);
//       return;
//     });

//     test("Complete works", async () => {
//       const completion = await llm.complete("Hello");

//       expect(completion.length).toBeGreaterThan(0);
//       console.log(completion);
//       return;
//     });
//   });
// }

// describe("LLM", () => {
//   // testLLM(
//   //   new FreeTrial({
//   //     model: "gpt-3.5-turbo",
//   //   })
//   // );
//   // testLLM(
//   //   new Anthropic({
//   //     model: "claude-2",
//   //     apiKey: process.env.ANTHROPIC_API_KEY,
//   //   })
//   // );
//   // testLLM(
//   //   new OpenAI({ apiKey: process.env.OPENAI_API_KEY, model: "gpt-3.5-turbo" })
//   // );
//   // TODO: Fix Replicate
//   // testLLM(
//   //   new Replicate({
//   //     apiKey: process.env.REPLICATE_API_KEY,
//   //     model: "codellama-7b",
//   //   })
//   // );
//   // testLLM(new LMStudio({ model: "codellama" }));
//   // testLLM(new Ollama({ model: "codellama-7b" }));
//   // testLLM(
//   //   new Together({
//   //     apiKey: process.env.TOGETHER_API_KEY,
//   //     model: "codellama-7b",
//   //   })
//   // );
//   // testLLM(new LlamaCpp({ model: "deepseek-7b" }));
//   // TODO: Test these
//   // testLLM(new TextGenWebUI({ model: "codellama-7b" }));
//   // testLLM(new HuggingFaceTGI({ model: "codellama-7b" }));
//   // testLLM(new HuggingFaceInferenceAPI({ model: "codellama-7b" }));
// });
