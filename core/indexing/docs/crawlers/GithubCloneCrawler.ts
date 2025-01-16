// import { mkdtemp, readdir, stat, readFile, rm } from "fs/promises";
// import { tmpdir } from "os";
// import { join, extname } from "path";
// import { promisify } from "util";
// import { exec } from "child_process";
// import { URL } from "url";

// const execAsync = promisify(exec);

// export interface PageData {
//   path: string;
//   url: string;
//   content: string;
// }

// export class GithubLocalCloneCrawler {
//   private repoUrl: string;

//   constructor(repoUrl: string) {
//     const url = new URL(repoUrl);
//     const [_, owner, repo] = url.pathname.split("/");
//     url.pathname = `/${owner}/${repo}${repo.includes(".git") ? "" : ".git"}`;
//     this.repoUrl = url.toString();
//   }

//   private async collectMarkdownFiles(
//     dirPath: string,
//     results: string[] = [],
//   ): Promise<string[]> {
//     const entries = await readdir(dirPath, { withFileTypes: true });
//     for (const entry of entries) {
//       const fullPath = join(dirPath, entry.name);
//       if (entry.isDirectory()) {
//         await this.collectMarkdownFiles(fullPath, results);
//       } else if (/\.mdx?$/.test(extname(entry.name).toLowerCase())) {
//         results.push(fullPath);
//       }
//     }
//     return results;
//   }

//   public async *crawl(): AsyncGenerator<PageData> {
//     const tempDir = await mkdtemp(join(tmpdir(), "repo-"));

//     try {
//       await execAsync(`git clone --depth=1 ${this.repoUrl} .`, {
//         cwd: tempDir,
//       });
//       const markdownFiles = await this.collectMarkdownFiles(tempDir);

//       for (const filePath of markdownFiles) {
//         const content = await readFile(filePath, "utf8");
//         yield {
//           path: filePath,
//           url: this.repoUrl,
//           content,
//         };
//       }
//     } finally {
//       await rm(tempDir, { recursive: true });
//     }
//   }
// }
