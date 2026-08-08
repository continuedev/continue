#!/usr/bin/env node

import { readFileSync } from "fs";
import { parseConfigYaml } from "./load/unroll.js";
import { validateConfigYaml } from "./validation.js";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Please provide a YAML file path");
    process.exit(1);
  }

  try {
    // Read and parse the YAML file
    const fileContents = readFileSync(filePath, "utf-8");
    const parsedYaml = parseConfigYaml(fileContents);

    // Validate the config
    const validationErrors = validateConfigYaml(parsedYaml);

    if (validationErrors.length === 0) {
      console.log("✅ Config file is valid!");
      process.exit(0);
    } else {
      console.error("❌ Config file validation failed:");
      validationErrors.forEach((error) => {
        console.error(`- ${error.message}`);
      });
      process.exit(1);
    }
  } catch (error: any) {
    console.error("Error processing file:", error.message);
    process.exit(1);
  }
}

main().catch(console.error);
