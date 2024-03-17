import { Octokit } from "@octokit/rest";
import cheerio from "cheerio";
import fetch from "node-fetch";
import { URL } from 'url';

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
    .filter(
      (file) => file.type === "blob" && file.path?.endsWith(".md"),
    )
    .map((file) => baseUrl.pathname + "/tree/main/" + file.path);

  return paths;
}

async function getLinksFromUrl(url: string, path: string) {
    const location = new URL(path, url);
    let response;
    try {
        response = await fetch(location.toString());
    } catch (error: unknown) {
        if (error instanceof Error && error.message.includes('maximum redirect')) {
            console.error('Maximum redirect reached for: ', location.toString());
            return {
                html: '',
                links: []
            };
        } else {
            console.error(error);
            return {
                html: '',
                links: []
            };
        }
    }

    const html = await response.text();
    let links: string[] = [];

    if (url.includes("github.com")) {
      return {
        html,
        links
      };
    }

    const $ = cheerio.load(html);

    $('a').each((_, element) => {
        const link = $(element).attr('href');
        if (link) {
            const fullUrl = new URL(link, url);

            if (fullUrl.pathname.startsWith(path)) {
                links.push(fullUrl.pathname);
            }
        }
    });

    links = [...new Set(links)].filter(link => {
      return !link.includes('#') && !IGNORE_PATHS_ENDING_IN.some(ending => link.endsWith(ending));
    });

    return {
        html,
        links
    };
}

function splitUrl(url: URL) {
    const baseUrl = `${url.protocol}//${url.hostname}`;
    const basePath = url.pathname;
    return {
        baseUrl,
        basePath
    };
}

export type PageData = {
    url: string;
    path: string;
    html: string;
};
 
export async function* crawlPage(url: URL): AsyncGenerator<PageData> {
  const { baseUrl, basePath } = splitUrl(url);
  let paths: string[] = [basePath];

  if (url.hostname === "github.com") {
    const githubLinks = await crawlGithubRepo(url);
    paths = [...paths, ...githubLinks];
  }

  let index = 0;

  while (index < paths.length) {
    const promises = paths.slice(index, index + 50).map(path => getLinksFromUrl(baseUrl, path));

    const results = await Promise.all(promises);

    for (const {html, links} of results) {
      if (html !== '') { 
        yield {
          url: url.toString(),   
          path: paths[index],
          html: html
        };
      }

      for (let link of links) {
        if (!paths.includes(link)) {
          paths.push(link);
        }
      }

      index++;
    }

    paths = paths.filter(path => results.some(result => result.html !== '' && result.links.includes(path)));
  }
}