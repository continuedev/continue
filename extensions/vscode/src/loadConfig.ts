import { getContinueGlobalPath } from "./activation/environmentSetup";
import * as path from "path";
const tsNode = require("ts-node");

export function loadTsConfig(): string {
  // Compile the TypeScript file and bundle all dependencies
  const output = tsNode.compileFile(
    path.join(getContinueGlobalPath(), "continue.config.ts"),
    {
      bundle: true,
    }
  );

  console.log(output); // Output the bundled JavaScript code

  return output;
}
