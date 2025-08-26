#!/usr/bin/env node

import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Colors for output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

/**
 * Parse the build.mjs file to extract defined aliases
 */
function getDefinedAliases() {
  const buildPath = resolve(__dirname, "build.mjs");
  const buildContent = readFileSync(buildPath, "utf8");

  // Find the alias object in the build file
  const aliasMatch = buildContent.match(/alias:\s*{([^}]+)}/s);
  if (!aliasMatch) {
    console.warn(
      `${colors.yellow}Warning: No aliases found in build.mjs${colors.reset}`,
    );
    return new Set();
  }

  // Extract package names from the alias definitions
  // Split by lines and filter out comments
  const aliasBlock = aliasMatch[1];
  const lines = aliasBlock.split("\n");
  const aliases = new Set();

  for (const line of lines) {
    // Skip commented lines
    if (line.trim().startsWith("//")) {
      continue;
    }

    // Look for package names in non-commented lines
    // Match both quoted and unquoted keys
    const quotedMatch = line.match(/"([^"]+)":/);
    const unquotedMatch = line.match(/\s+([a-zA-Z@][a-zA-Z0-9@\/_-]*)\s*:/);

    if (quotedMatch) {
      aliases.add(quotedMatch[1]);
    } else if (
      unquotedMatch &&
      !unquotedMatch[1].includes("__dirname") &&
      unquotedMatch[1] !== "js"
    ) {
      aliases.add(unquotedMatch[1]);
    }
  }

  return aliases;
}

/**
 * Find all local packages referenced with file: in package.json files
 */
function findLocalPackages(startPath, visited = new Set()) {
  const localPackages = new Set();

  function scanPackageJson(packageJsonPath, depth = 0) {
    // Avoid infinite recursion
    if (visited.has(packageJsonPath) || depth > 10) {
      return;
    }
    visited.add(packageJsonPath);

    if (!existsSync(packageJsonPath)) {
      return;
    }

    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      const packageDir = dirname(packageJsonPath);

      // Check both dependencies and devDependencies
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      for (const [depName, depVersion] of Object.entries(allDeps)) {
        if (typeof depVersion === "string" && depVersion.startsWith("file:")) {
          // This is a local package
          localPackages.add(depName);

          // Recursively check this package's dependencies
          const depPath = resolve(packageDir, depVersion.replace("file:", ""));
          const depPackageJson = resolve(depPath, "package.json");

          if (existsSync(depPackageJson)) {
            scanPackageJson(depPackageJson, depth + 1);
          }
        }
      }
    } catch (error) {
      console.error(
        `${colors.red}Error reading ${packageJsonPath}: ${error.message}${colors.reset}`,
      );
    }
  }

  // Start from the CLI's package.json
  scanPackageJson(startPath);

  return localPackages;
}

/**
 * Main validation function
 */
function validateAliases() {
  console.log(
    `${colors.blue}🔍 Validating esbuild aliases...${colors.reset}\n`,
  );

  // Get defined aliases from build.mjs
  const definedAliases = getDefinedAliases();
  // console.log(`Found ${definedAliases.size} aliases in build.mjs:`);
  // definedAliases.forEach(alias => {
  //   console.log(`  ✓ ${alias}`);
  // });
  // console.log();

  // Find all local packages that need aliases
  const cliPackageJson = resolve(__dirname, "package.json");
  const localPackages = findLocalPackages(cliPackageJson);
  // console.log(`Found ${localPackages.size} local package dependencies:`);
  // localPackages.forEach(pkg => {
  //   console.log(`  • ${pkg}`);
  // });
  // console.log();

  // Check for missing aliases
  const missingAliases = [];
  for (const pkg of localPackages) {
    if (!definedAliases.has(pkg)) {
      missingAliases.push(pkg);
    }
  }

  // Check for unnecessary aliases (defined but not used)
  const unnecessaryAliases = [];
  for (const alias of definedAliases) {
    if (!localPackages.has(alias)) {
      unnecessaryAliases.push(alias);
    }
  }

  // Report results
  if (missingAliases.length > 0) {
    console.log(
      `${colors.red}❌ Missing aliases (WILL CAUSE RUNTIME ERRORS):${colors.reset}`,
    );
    missingAliases.forEach((pkg) => {
      console.log(`  ✗ ${pkg}`);
    });
    console.log();
    console.log(
      `${colors.red}Add these to the alias section in build.mjs:${colors.reset}`,
    );
    missingAliases.forEach((pkg) => {
      const packageName = pkg.replace("@continuedev/", "").replace(/-/g, "_");
      console.log(
        `  "${pkg}": resolve(__dirname, "../../packages/${pkg.replace("@continuedev/", "")}/dist/index.js"),`,
      );
    });
    console.log();
  }

  if (unnecessaryAliases.length > 0) {
    console.log(
      `${colors.yellow}⚠️  Potentially unnecessary aliases:${colors.reset}`,
    );
    unnecessaryAliases.forEach((alias) => {
      console.log(`  ? ${alias}`);
    });
    console.log();
  }

  // Exit with appropriate code
  if (missingAliases.length > 0) {
    console.log(
      `${colors.red}✗ Validation failed! Missing ${missingAliases.length} required alias(es).${colors.reset}`,
    );
    console.log(
      `${colors.red}This would cause runtime errors in the bundled CLI.${colors.reset}`,
    );
    process.exit(1);
  } else if (unnecessaryAliases.length > 0) {
    console.log(
      `${colors.yellow}✓ Validation passed with warnings.${colors.reset}`,
    );
    process.exit(0);
  } else {
    console.log(
      `${colors.green}✅ All aliases are correctly configured!${colors.reset}`,
    );
    process.exit(0);
  }
}

// Run validation
validateAliases();
