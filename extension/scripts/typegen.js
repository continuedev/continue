const fs = require("fs");
const path = require("path");
const { compile } = require("json-schema-to-typescript");

function generateTypesForFile(inputPath, outputPath) {
  let schema = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  let name = path.parse(path.basename(inputPath)).name;
  // This is to solve the issue of json-schema-to-typescript not supporting $ref at the top-level, which is what Pydantic generates for recursive types
  if ("$ref" in schema) {
    let temp = schema["$ref"];
    delete schema["$ref"];
    schema["allOf"] = [{ $ref: temp }];
  }

  compile(schema, name)
    .then((ts) => {
      fs.writeFileSync(path.join(outputPath, name + ".d.ts"), ts);
    })
    .catch((e) => {
      console.log("Error generating types for " + name);
      throw e;
    });
}

function generateAllSchemas(inputDir, outputDir) {
  // get the current directory
  try {
    fs.readdirSync(inputDir).forEach((file) => {
      if (file.endsWith(".json")) {
        generateTypesForFile(path.join(inputDir, file), outputDir);
      }
    });
  } catch (e) {
    console.log(
      "Make sure you are running this script from the extension/ directory."
    );
    throw e;
  }
}

function deleteAllInDir(dir) {
  fs.readdirSync(dir).forEach((file) => {
    if (file.endsWith(".d.ts")) {
      fs.unlinkSync(path.join(dir, file));
    }
  });
}

const OUTPUT_DIR = path.join("schema");
const INPUT_DIR = path.join("..", "schema", "json");
if (!fs.existsSync(INPUT_DIR)) {
  throw new Error(`Input directory does not exist: ${INPUT_DIR}`);
}

if (!fs.existsSync(OUTPUT_DIR)) {
  throw new Error(`Output directory does not exist: ${OUTPUT_DIR}`);
}

deleteAllInDir(OUTPUT_DIR);
generateAllSchemas(INPUT_DIR, OUTPUT_DIR);
