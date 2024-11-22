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
  const packagesByRegistry: Record<string, ParsedPackageInfo[]> = {};
  PACKAGE_CRAWLERS.forEach((Crawler) => {
    const crawler = new Crawler();
    const packageFiles = packageFilesByRegistry[crawler.packageRegistry];
    packageFiles.forEach((file) => {
      const contents = fileContents.get(file.path);
      if (!contents) {
        return;
      }
      const packages = crawler.parsePackageFile(file, contents);
      if (!packagesByRegistry[crawler.packageRegistry]) {
        packagesByRegistry[crawler.packageRegistry] = [];
      }
      packagesByRegistry[crawler.packageRegistry].push(...packages);
    });
  });

  // Deduplicate packages per language
  // TODO - this is where you would allow docs for different versions
  // by e.g. using "name-version" as the map key instead of just name
  // For now have not allowed
  const languages = Object.keys(packagesByRegistry);
  languages.forEach((language) => {
    const packages = packagesByRegistry[language];
    const uniquePackages = Array.from(
      new Map(packages.map((pkg) => [pkg.name, pkg])).values(),
    );
    packagesByRegistry[language] = uniquePackages;
  });

  // Get documentation links for all packages
  const allDocsResults: PackageDocsResult[] = [];
  await Promise.all(
    PACKAGE_CRAWLERS.map(async (Crawler) => {
      const crawler = new Crawler();
      const packages = packagesByRegistry[crawler.packageRegistry];
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

// write me an interface PackageCrawler that contains:
// 1. property `language` to store a given language like "python" or "typescript"
// 2. has a method `getPackageFiles` which takes a list of file names and decides which ones match package/dependency files (e.g. package.json for typescript, requirements.txt for python, etc)
// 3. has a method `parsePackageFile` which returns a list of package name and version from a relevant package file, in a standardized format like semver
// 4. has a method `getDocumentationLink` to check for documentation link for a given package (e.g. GET `https://registry.npmjs.org/<package>` and find docs field for typescript, documentation link in the package metadata for PyPi, etc.)
// Then, write typescript classes to implement this typescript interface for the languages "python" and "typescript"

// I want to present the user with a list of dependencies and allow them to select which ones to index (embed) documentation for.
// In order to prevent duplicate file reads, the process will be like this:
// 1. take in a list of filepaths called `filepaths`
// 2. loop an array of PackageCrawler classes to build a map of `language` (string) to `packageFilePaths` (string[])
// 3. Get unique filepaths from `packageFilePaths` and build a map ` of filepath to file contents using an existing `readFile` function, and skipping file reads of already in the map
// Finally,
// Add a `` method to the interface and classes that returns
// Then, assemble the classes in an array, and write a function getAllSuggestedDocs that returns a map of `language` to an ar
