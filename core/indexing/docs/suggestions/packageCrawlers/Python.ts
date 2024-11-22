import { PackageCrawler } from "..";
import {
  FilePathAndName,
  PackageDetails,
  PackageFilePathAndName,
  ParsedPackageInfo,
} from "../../../..";

export class PythonPackageCrawler implements PackageCrawler {
  packageRegistry = "pypi";

  getPackageFiles(files: FilePathAndName[]): PackageFilePathAndName[] {
    // For Python, we typically look for files like requirements.txt or Pipfile
    return files
      .filter(
        (file) => file.name === "requirements.txt" || file.name === "Pipfile",
      )
      .map((file) => ({
        ...file,
        packageRegistry: "pypi",
      }));
  }

  parsePackageFile(
    file: PackageFilePathAndName,
    contents: string,
  ): ParsedPackageInfo[] {
    // Assume the fileContent is a string from a requirements.txt formatted file
    return contents
      .split("\n")
      .map((line) => {
        const [name, version] = line.split("==");
        return { name, version, packageFile: file, language: "py" };
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
    const homePage = data?.info?.home_page as string | undefined;

    return {
      docsLink:
        (data?.info?.project_urls?.Documentation as string | undefined) ??
        homePage,
      title: data?.info?.name as string | undefined,
      description: data?.info?.summary as string | undefined,
      repo:
        (data?.info?.project_urls?.Repository as string | undefined) ??
        homePage,
      license: data?.info?.license as string | undefined,
    };
  }
}
