import { PackageCrawler } from "..";
import {
  FilePathAndName,
  PackageDetails,
  PackageFilePathAndName,
  ParsedPackageInfo,
} from "../../../..";

export class NodePackageCrawler implements PackageCrawler {
  packageRegistry = "npm";

  getPackageFiles(files: FilePathAndName[]): PackageFilePathAndName[] {
    // For Javascript/TypeScript, we look for package.json file
    return files
      .filter((file) => file.name === "package.json")
      .map((file) => ({
        ...file,
        packageRegistry: this.packageRegistry,
      }));
  }

  parsePackageFile(
    file: PackageFilePathAndName,
    contents: string,
  ): ParsedPackageInfo[] {
    // Parse the package.json content
    const jsonData = JSON.parse(contents) as Record<string, Object>;
    const dependencies = Object.entries(jsonData.dependencies || {}).concat(
      Object.entries(jsonData.devDependencies || {}),
    );

    // Filter out types packages and check if typescript is present
    let foundTypes = false;
    const filtered = dependencies.filter(([name, _]) => {
      if (name.startsWith("@types/")) {
        foundTypes = true;
        return false;
      }
      if (name.includes("typescript")) {
        foundTypes = true;
      }
      return true;
    });
    return filtered.map(([name, version]) => ({
      name,
      version,
      packageFile: file,
      language: foundTypes ? "ts" : "js",
    }));
  }

  async getPackageDetails(
    packageInfo: ParsedPackageInfo,
  ): Promise<PackageDetails> {
    const { name } = packageInfo;
    // Fetch metadata from the NPM registry to find the documentation link
    const response = await fetch(`https://registry.npmjs.org/${name}`);
    if (!response.ok) {
      throw new Error(`Could not fetch data for package ${name}`);
    }
    const data = await response.json();

    //   const dependencies = Object.keys(packageContentData.dependencies || {})
    //   .concat(Object.keys(packageContentData.devDependencies || {}));
    // const usesTypescript = dependencies.includes("typescript");

    return {
      docsLink: data.homepage as string | undefined,
      title: name, // package.json doesn't have specific title field
      description: data.description as string | undefined,
      repo: Array.isArray(data.repository)
        ? (data.respository[0]?.url as string | undefined)
        : undefined,
      license: data.license as string | undefined,
    };
  }
}
