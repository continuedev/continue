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

async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const octokit = new Octokit({ auth: undefined });

  const repoInfo = await octokit.repos.get({
    owner,
    repo,
  });

  return repoInfo.data.default_branch;
}

async function crawlGithubRepo(baseUrl: URL) {
  const octokit = new Octokit({
    auth: undefined,
  });

  const [_, owner, repo] = baseUrl.pathname.split("/");

  const branch = await getDefaultBranch(owner, repo)
  console.log("Github repo detected. Crawling", branch, "branch")


  const tree = await octokit.request(
    "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
    {
      owner,
      repo,
      tree_sha: branch,
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
  console.log("Starting crawl from: ", url, " - Max Depth: ", maxDepth)
  const { baseUrl, basePath } = splitUrl(url);
  let paths: { path: string; depth: number }[] = [{ path: basePath, depth: 0 }];
  
  if (url.hostname === "github.com") {
    const githubLinks = await crawlGithubRepo(url);
    const githubLinkObjects = githubLinks.map(link => ({
        path: link,
        depth: 0, 
    }));
    paths = [...paths, ...githubLinkObjects];
  }

  let index = 0;
  while (index < paths.length) {
    const batch = paths.slice(index, index + 50);

    try { 
      const promises = batch.map(({ path, depth }) => getLinksFromUrl(baseUrl, path).then(links => ({ links, path, depth }))); // Adjust for depth tracking
      
      const results = await Promise.all(promises);
      for (const { links: { html, links: linksArray }, path, depth } of results) {
        if (html !== "" && depth <= maxDepth) { // Check depth
          yield {
            url: url.toString(),
            path,
            html,
          };
        }
        
        // Ensure we only add links if within depth limit
        if (depth < maxDepth) {
          for (let link of linksArray) {
            if (!paths.some(p => p.path === link)) {
              paths.push({ path: link, depth: depth + 1 }); // Increment depth for new paths
            }
          }
        }
      }
    } catch(e){
      if (e instanceof TypeError) {
        console.warn("Error while crawling page: ", e) // Likely an invalid url, continue with process
      } else {
        console.error("Error while crawling page: ", e)
      }
    }

    index += batch.length; // Proceed to next batch
  }
  console.log("Crawl completed")
}
