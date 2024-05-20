import { Octokit } from "@octokit/rest";
import cheerio from "cheerio";
import fetch from "node-fetch";
import { URL } from "url";

const IGNORE_PATHS_ENDING_IN = [
  "favicon.ico",
  "robots.txt",
  ".rst.txt",
  "genindex",
  "py-modindex",
  "search.html",
  "search",
  "genindex.html",
  "changelog",
  "changelog.html",
];

const GITHUB_PATHS_TO_TRAVERSE = ["/blob/", "/tree/"];

async function crawlGithubRepo(baseUrl: URL) {
  const octokit = new Octokit({
    auth: undefined,
  });

  const [_, owner, repo] = baseUrl.pathname.split("/");

  let dirContentsConfig = {
    owner: owner,
    repo: repo,
  };

  const tree = await octokit.request(
    "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
    {
      owner,
      repo,
      tree_sha: "main",
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
      recursive: "true",
    },
  );

  const paths = tree.data.tree
    .filter((file: any) => file.type === "blob" && file.path?.endsWith(".md"))
    .map((file: any) => baseUrl.pathname + "/tree/main/" + file.path);

  return paths;
}

async function getLinksFromUrl(url: string, path: string) {
  const baseUrl = new URL(url);
  const location = new URL(path, url);
  let response;

  //ToDo: Should have some method of checking if location is valid or not

  try {
    response = await fetch(location.toString());
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("maximum redirect")) {
      console.error("Maximum redirect reached for: ", location.toString());
      return {
        html: "",
        links: [],
      };
    } else {
      console.error(error);
      return {
        html: "",
        links: [],
      };
    }
  }

  const html = await response.text();
  let links: string[] = [];

  if (url.includes("github.com")) {
    return {
      html,
      links,
    };
  }

  const $ = cheerio.load(html);

  $("a").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) {
      return;
    }

    const parsedUrl = new URL(href, url);
    if (
      parsedUrl.hostname === baseUrl.hostname
      // parsedUrl.pathname.startsWith(baseUrl.pathname)
    ) {
      links.push(parsedUrl.pathname);
    }
  });

  links = [...new Set(links)].filter((link) => {
    return (
      !link.includes("#") &&
      !IGNORE_PATHS_ENDING_IN.some((ending) => link.endsWith(ending))
    );
  });

  return {
    html,
    links,
  };
}

function splitUrl(url: URL) {
  const baseUrl = `${url.protocol}//${url.hostname}${
    url.port ? ":" + url.port : ""
  }`;
  const basePath = url.pathname;
  return {
    baseUrl,
    basePath,
  };
}

export type PageData = {
  url: string;
  path: string;
  html: string;
};

export async function* crawlPage(url: URL, maxDepth: number = 3): AsyncGenerator<PageData> {
  console.log("starting crawl")
  const { baseUrl, basePath } = splitUrl(url);
  let paths: { path: string; depth: number }[] = [{ path: basePath, depth: 0 }];
  
  let index = 0;

  while (index < paths.length) {
    const batch = paths.slice(index, index + 50);

    try { 
      const promises = batch.map(({ path, depth }) => getLinksFromUrl(baseUrl, path).then(links => ({ links, path, depth }))); // Adjust for depth tracking
      
      const results = await Promise.all(promises);
      console.log("results length: ", results.length)
      for (const { links: { html, links: linksArray }, path, depth } of results) {
        if (html !== "" && depth <= maxDepth) { // Check depth
          console.log("Depth: ", depth)
          yield {
            url: url.toString(),
            path,
            html,
          };
        }
        
        // Ensure we only add links if within depth limit
        if (depth < maxDepth) {
          console.log("Depth: ", depth)
          for (let link of linksArray) {
            if (!paths.some(p => p.path === link)) {
              paths.push({ path: link, depth: depth + 1 }); // Increment depth for new paths
            }
          }
        }
      }
    } catch(e){
        console.warn("Error while crawling page: ", e)
    }

    index += batch.length; // Proceed to next batch
  }
  console.log("crawl completed")
}
