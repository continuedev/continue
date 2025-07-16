import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageJsonPath = join(__dirname, "../package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    return packageJson.version;
  } catch (error) {
    console.warn("Warning: Could not read version from package.json");
    return "unknown";
  }
}
