import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { configYamlSchema } from "../schemas/index.js";
import { modelsFileSchema, providersFileSchema } from "../schemas/models.js";

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// One JSON schema per file: a config, the model catalog and the accounts
const schemas: [string, z.ZodType][] = [
  ["config-yaml-schema.json", configYamlSchema],
  ["models-yaml-schema.json", modelsFileSchema],
  ["providers-yaml-schema.json", providersFileSchema],
];

// Output directory
const outDir = path.resolve(__dirname, "../../schema");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

for (const [file, schema] of schemas) {
  const jsonSchema = z.toJSONSchema(schema, {
    target: "draft-7",
    io: "input",
    unrepresentable: "any",
  });
  const outFile = path.join(outDir, file);
  fs.writeFileSync(outFile, JSON.stringify(jsonSchema, null, 2));
  console.log(`JSON schema has been written to ${outFile}`);
}
