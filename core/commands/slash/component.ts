import { SlashCommand } from "../../index.js";
import { stripImages } from "../../llm/images.js";

const ComponentMessageCommand: SlashCommand = {
  name: "component",
  description: "Generate a React component using v0",
  run: async function* ({ llm, input }) {
    if (input.trim() === "") {
      yield "Please provide a description of the React component you want to generate. For example, '/component Create a dashboard with a user table'.";
      return;
    }

    const gen = `The user has requested to generate a React UI component using the following prompt:

"${input}"

Expand on the prompt to add more details with bullet points. If a picture is attached as well, then make sure the description also aligns with the UI shown in the picture. We'll send the expanded prompt to a different API to generate the actual code for the component. Do not assume they will have knowledge of our files or filenames, so include whatever context needed in the bullet point descriptions. Do not include the command /component. Do not add information about styles (Material UI, bootstrap). Only use the template below in your response. The prompt in the markdown link must be properly URL encoded. Include new line encoding %0A. Ensure the bullet points have spaces between the dash and the first word.

Response template:

Sure, I can generate the {Component Name} component with the following details:

- Detail #1
- Detail #2

Here is a link to generate this component:

[Capitalised Component Name](https://v0.dev/chat?q={expanded prompt})

You must be signed in with Vercel to generate this component.
												 `;
    for await (const chunk of llm.streamChat([
      { role: "user", content: gen },
    ])) {
      yield stripImages(chunk.content);
    }
  },
};

export default ComponentMessageCommand;
