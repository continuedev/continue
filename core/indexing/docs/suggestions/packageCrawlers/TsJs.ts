import { PackageCrawler } from "..";
import {
  FilePathAndName,
  PackageDetails,
  ParsedPackageInfo,
} from "../../../..";

export class TypeScriptPackageCrawler implements PackageCrawler {
  language = "js-ts";

  getPackageFiles(files: FilePathAndName[]): FilePathAndName[] {
    // For Javascript/TypeScript, we look for package.json file
    return files.filter((file) => file.name === "package.json");
  }

  parsePackageFile(
    file: FilePathAndName,
    contents: string,
  ): ParsedPackageInfo[] {
    // Parse the package.json content
    const jsonData = JSON.parse(contents) as Record<string, Object>;
    const dependencies = Object.entries(jsonData.dependencies || {}).concat(
      Object.entries(jsonData.devDependencies || {}),
    );
    return dependencies.map(([name, version]) => ({
      name,
      version,
      packageFile: file,
      language: this.language,
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
    return {
      docsLink: data.homepage as string | undefined,
      // title: data.name,
      // description: data.description as string | undefined,
    };
  }
}
