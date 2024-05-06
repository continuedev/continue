import { SlashCommand } from "../..";
import { stripImages } from "../../llm/countTokens";

function promptAsCodeCommandGenerator(file): SlashCommand {

    // read name from file
    // read description from file
    // read prompt from file, still with {{ input }} and {{ selection }} ....
    // maybe in another version, also have @folder, @workspace tags in the prompt to automatically add context to it

  let prompt = "myprompt"

  return {
    name: "myname",
    description: "mydescription",
    
    run: async function* ({ ide, llm, input }) {
      const diff = await ide.getDiff();
      
      // read any other necessary variables here. For example: selection and input
      // dynamically replace the prompt variables with selection, diff and input
      
      for await (const chunk of llm.streamChat([
        { role: "user", content: prompt },
      ])) {
        yield stripImages(chunk.content);
      }
    },
  };
}

