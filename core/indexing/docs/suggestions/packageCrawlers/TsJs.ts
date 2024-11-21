import { PackageCrawler, PackageDocsResult, PackageInfo } from "..";

export class TypeScriptPackageCrawler implements PackageCrawler {
  language = "typescript";

  getPackageFiles(fileNames: string[]): string[] {
    // For TypeScript, we look for package.json file
    return fileNames.filter((fileName) => fileName === "package.json");
  }

  parsePackageFile(fileContent: string, filepath: string): PackageInfo[] {
    // Parse the package.json content
    const jsonData = JSON.parse(fileContent) as Record<string, Object>;
    const dependencies = Object.entries(jsonData.dependencies || {}).concat(
      Object.entries(jsonData.devDependencies || {}),
    );
    return dependencies.map(([name, version]) => ({
      name,
      version,
      foundInFilepath: filepath,
    }));
  }

  async getDocumentationLink(packageName: string): Promise<PackageDocsResult> {
    // Fetch metadata from the NPM registry to find the documentation link
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    if (!response.ok) {
      throw new Error(`Could not fetch data for package ${packageName}`);
    }
    const data = await response.json();
    return data.homepage;
  }
}
