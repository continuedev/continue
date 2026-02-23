import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { configYamlSchema } from "../schemas/index.js";

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Convert Zod schema to JSON schema
const jsonSchema = zodToJsonSchema(configYamlSchema, {
  $refStrategy: "none",
  name: "ConfigYaml",
});

// Output directory and file path
const outDir = path.resolve(__dirname, "../../schema");
const outFile = path.join(outDir, "config-yaml-schema.json");

// Ensure output directory exists
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Write the JSON schema to file
fs.writeFileSync(outFile, JSON.stringify(jsonSchema, null, 2));

console.log(`JSON schema has been written to ${outFile}`);
