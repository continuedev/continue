import { Octokit } from "@octokit/rest";
import { NodeHtmlMarkdown, PostProcessResult } from "node-html-markdown";

const nhm = new NodeHtmlMarkdown(
  {},
  {
    a: {
      postprocess: (ctx) => {
        if (ctx.node.tagName === "A") {
          // Remove sections links (e.g. '<a href="#section-name" title="Link to this heading">#</a>')
          if (ctx.content.length <= 1) {
            return PostProcessResult.RemoveNode;
          }
        }
        return ctx.content;
      },
    },
  },
  undefined,
);

const STRIP_BEFORE = ["\n# "];
const STRIP_AFTER_AND_INCLUDING = ["Was this page helpful?"];

const octokit = new Octokit({
  auth: undefined,
});
async function retrieveGitHubBlob(url: URL): Promise<string | undefined> {
  const [_, owner, repo, _tree, _main, ...path] = url.pathname.split("/");
  const response = await octokit.repos.getContent({
    owner,
    repo,
    path: path.join("/"),
  });

  if (response.status !== 200) {
    return undefined;
  }

  const content = Buffer.from(
    (response.data as any).content || "",
    "base64",
  ).toString();

  const fileExtension = url.pathname.split(".").slice(-1)[0];
  if (fileExtension === "md") {
    return content;
  }

  return `\`\`\`${fileExtension} title=${path.join("/")}\n${content}\n\`\`\``;
}

export async function convertURLToMarkdown(
  url: URL,
): Promise<string | undefined> {
  try {
    if (url.hostname === "github.com") {
      return await retrieveGitHubBlob(url);
    }

    const response = await fetch(url);

    if (!response.ok) {
      return undefined;
    }

    const htmlContent = await response.text();
    let markdown = nhm.translate(htmlContent).trimEnd();

    // Check for 404
    if (markdown.includes("404 Not Found")) {
      return undefined;
    }

    // Strip above and below certain phrases
    STRIP_BEFORE.forEach((phrase) => {
      const index = markdown.indexOf(phrase);
      if (index !== -1) {
        markdown = markdown.slice(index);
      }
    });
    STRIP_AFTER_AND_INCLUDING.forEach((phrase) => {
      const index = markdown.lastIndexOf(phrase);
      if (index !== -1) {
        markdown = markdown.slice(0, index);
      }
    });

    return markdown;
  } catch (err) {
    console.error("Error converting URL to markdown", err);
    return undefined;
  }
}
