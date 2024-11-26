import {
  PackageDocsResult,
  FilePathAndName,
  PackageFilePathAndName,
  IDE,
  PackageDetails,
  ParsedPackageInfo,
} from "../../..";
import { walkDir } from "../../walkDir";

import { PythonPackageCrawler } from "./packageCrawlers/Python";
import { NodePackageCrawler } from "./packageCrawlers/TsJs";

const PACKAGE_CRAWLERS = [NodePackageCrawler, PythonPackageCrawler];

export interface PackageCrawler {
  packageRegistry: string;
  getPackageFiles(files: FilePathAndName[]): PackageFilePathAndName[];
  parsePackageFile(
    file: PackageFilePathAndName,
    contents: string,
  ): ParsedPackageInfo[];
  getPackageDetails(packageInfo: ParsedPackageInfo): Promise<PackageDetails>;
}

export async function getAllSuggestedDocs(ide: IDE) {
  const workspaceDirs = await ide.getWorkspaceDirs();
  const results = await Promise.all(
    workspaceDirs.map((dir) => {
      return walkDir(dir, ide);
    }),
  );
  const allPaths = results.flat(); // TODO only get files, not dirs. Not critical for now
  const allFiles = allPaths.map((path) => ({
    path,
    name: path.split(/[\\/]/).pop()!,
  }));

  // Build map of language -> package files
  const packageFilesByRegistry: Record<string, PackageFilePathAndName[]> = {};
  for (const Crawler of PACKAGE_CRAWLERS) {
    const crawler = new Crawler();
    const packageFilePaths = crawler.getPackageFiles(allFiles);
    packageFilesByRegistry[crawler.packageRegistry] = packageFilePaths;
  }

  // Get file contents for all unique package files
  const uniqueFilePaths = Array.from(
    new Set(
      Object.values(packageFilesByRegistry).flatMap((files) =>
        files.map((file) => file.path),
      ),
    ),
  );
  const fileContentsArray = await Promise.all(
    uniqueFilePaths.map(async (path) => {
      const contents = await ide.readFile(path);
      return { path, contents };
    }),
  );
  const fileContents = new Map(
    fileContentsArray.map(({ path, contents }) => [path, contents]),
  );

  // Parse package files and build map of language -> packages
  const packagesByCrawler: Record<string, ParsedPackageInfo[]> = {};
  PACKAGE_CRAWLERS.forEach((Crawler) => {
    const crawler = new Crawler();
    packagesByCrawler[crawler.packageRegistry] = [];
    const packageFiles = packageFilesByRegistry[crawler.packageRegistry];
    packageFiles.forEach((file) => {
      const contents = fileContents.get(file.path);
      if (!contents) {
        return;
      }
      const packages = crawler.parsePackageFile(file, contents);
      packagesByCrawler[crawler.packageRegistry].push(...packages);
    });
  });

  // Deduplicate packages per language
  // TODO - this is where you would allow docs for different versions
  // by e.g. using "name-version" as the map key instead of just name
  // For now have not allowed
  const registries = Object.keys(packagesByCrawler);
  registries.forEach((registry) => {
    const packages = packagesByCrawler[registry];
    const uniquePackages = Array.from(
      new Map(packages.map((pkg) => [pkg.name, pkg])).values(),
    );
    packagesByCrawler[registry] = uniquePackages;
  });

  // Get documentation links for all packages
  const allDocsResults: PackageDocsResult[] = [];
  await Promise.all(
    PACKAGE_CRAWLERS.map(async (Crawler) => {
      const crawler = new Crawler();
      const packages = packagesByCrawler[crawler.packageRegistry];
      const docsByRegistry = await Promise.all(
        packages.map(async (packageInfo) => {
          try {
            const details = await crawler.getPackageDetails(packageInfo);
            if (!details.docsLink) {
              return {
                packageInfo,
                error: `No documentation link found for ${packageInfo.name}`,
              };
            }
            return {
              packageInfo,
              details: {
                ...details,
                docsLink: details.docsLink,
                docsLinkWarning: details.docsLink.includes("github.com")
                  ? "Github docs not supported, find the docs site"
                  : details.docsLink.includes("docs")
                    ? undefined
                    : "May not be a docs site, check the URL",
              },
            };
          } catch (error) {
            return {
              packageInfo,
              error: `Error getting package details for ${packageInfo.name}`,
            };
          }
        }),
      );
      allDocsResults.push(...docsByRegistry);
    }),
  );
  return allDocsResults;
}
