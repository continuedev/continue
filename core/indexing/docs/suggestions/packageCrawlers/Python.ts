import { PackageCrawler } from "..";
import {
  FilePathAndName,
  PackageDetails,
  ParsedPackageInfo,
} from "../../../..";

export class PythonPackageCrawler implements PackageCrawler {
  language = "python";

  getPackageFiles(files: FilePathAndName[]): FilePathAndName[] {
    // For Python, we typically look for files like requirements.txt or Pipfile
    return files.filter(
      (file) => file.name === "requirements.txt" || file.name === "Pipfile",
    );
  }

  parsePackageFile(
    file: FilePathAndName,
    contents: string,
  ): ParsedPackageInfo[] {
    // Assume the fileContent is a string from a requirements.txt formatted file
    return contents
      .split("\n")
      .map((line) => {
        const [name, version] = line.split("==");
        return { name, version, packageFile: file, language: this.language };
      })
      .filter((pkg) => pkg.name && pkg.version);
  }

  async getPackageDetails(
    packageInfo: ParsedPackageInfo,
  ): Promise<PackageDetails> {
    // Fetch metadata from PyPI to find the documentation link

    const response = await fetch(
      `https://pypi.org/pypi/${packageInfo.name}/json`,
    );
    if (!response.ok) {
      throw new Error(`Could not fetch data for package ${packageInfo.name}`);
    }
    const data = await response.json();
    return {
      docsLink: data.info.project_urls?.Documentation as string | undefined,
      // title: data.info.name,
      // description: data.info.summary as string | undefined,
    };
  }
}
