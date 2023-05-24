const fs = require("fs");
const path = require("path");
const { compile } = require("json-schema-to-typescript");

function generateTypesForFile(inputPath, outputPath) {
  let schema = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  let name = (inputPath.split("/").pop() || inputPath).split(".")[0];
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

OUTPUT_DIR = "schema";
INPUT_DIR = "../schema/json";

deleteAllInDir(OUTPUT_DIR);
generateAllSchemas(INPUT_DIR, OUTPUT_DIR);
