import { ChatMessageRole, SlashCommand } from "../..";
import { pruneStringFromBottom, stripImages } from "../../llm/countTokens";

const SERVER_URL = "https://proxy-server-l6vsfbzhba-uw.a.run.app";
const PROMPT = (
  input: string,
) => `The above sources are excerpts from related StackOverflow questions. Use them to help answer the below question from our user. Provide links to the sources in markdown whenever possible:

${input}
`;

async function getResults(q: string): Promise<any> {
  const payload = JSON.stringify({
    q: `${q} site:stackoverflow.com`,
  });

  const resp = await fetch(`${SERVER_URL}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload,
  });
  return await resp.json();
}

async function fetchData(url: string): Promise<string | undefined> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html",
    },
  });
  const htmlString = await response.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");

  const h1 = doc.querySelector("h1.fs-headline1");
  const title = h1?.textContent?.trim() || "No Title";

  const bodies = doc.querySelectorAll("div.js-post-body");
  if (bodies.length < 2) {
    return undefined;
  }

  const question = bodies[0].textContent || "";
  const answer = bodies[1].textContent || "";

  return `
  # Question: [${title}](${url})

${question}

# Best Answer

${answer}
  `;
}

const StackOverflowSlashCommand: SlashCommand = {
  name: "so",
  description: "Search Stack Overflow",
  run: async function* ({ llm, input, addContextItem, history }) {
    const contextLength = llm.contextLength;

    const sources: string[] = [];
    const results = await getResults(input);
    const links = results.organic.map((result: any) => result.link);
    let totalTokens = llm.countTokens(input) + 200;

    for (const link of links) {
      const contents = await fetchData(link);
      if (!contents) {
        continue;
      }
      sources.push(contents);
      const newTokens = llm.countTokens(contents);
      totalTokens += newTokens;

      let shouldBreak = false;
      if (totalTokens > contextLength) {
        sources[sources.length - 1] = pruneStringFromBottom(
          llm.model,
          contextLength - (totalTokens - newTokens),
          sources[sources.length - 1],
        );
        shouldBreak = true;
      }

      if (sources.length >= 3) {
        shouldBreak = true;
      }

      addContextItem({
        content: sources[sources.length - 1],
        description: "StackOverflow Answer",
        name: `StackOverflow ${sources.length}`,
        id: {
          providerTitle: "so",
          itemId: links[sources.length - 1],
        },
      });

      if (shouldBreak) {
        break;
      }
    }

    for await (const chunk of llm.streamChat([
      ...history,
      ...sources.map((source) => ({
        role: "user" as ChatMessageRole,
        content: source,
      })),
      { role: "user", content: PROMPT(input) },
    ])) {
      yield stripImages(chunk.content);
    }
  },
};

export default StackOverflowSlashCommand;
