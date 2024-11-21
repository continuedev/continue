import { PackageCrawler, PackageDocsResult, PackageInfo } from "..";

export class PythonPackageCrawler implements PackageCrawler {
  language = "python";

  getPackageFiles(fileNames: string[]): string[] {
    // For Python, we typically look for files like requirements.txt or Pipfile
    return fileNames.filter(
      (fileName) => fileName === "requirements.txt" || fileName === "Pipfile",
    );
  }

  parsePackageFile(fileContent: string, filepath: string): PackageInfo[] {
    // Assume the fileContent is a string from a requirements.txt formatted file
    return fileContent
      .split("\n")
      .map((line) => {
        const [name, version] = line.split("==");
        return { name, version, foundInFilepath: filepath };
      })
      .filter((pkg) => pkg.name && pkg.version);
  }

  async getDocumentationLink(packageName: string): Promise<PackageDocsResult> {
    // Fetch metadata from PyPI to find the documentation link
    const response = await fetch(`https://pypi.org/pypi/${packageName}/json`);
    if (!response.ok) {
      throw new Error(`Could not fetch data for package ${packageName}`);
    }
    const data = await response.json();
    return data.info.project_urls?.Documentation;
  }
}
