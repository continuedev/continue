#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Find all snippet files
const snippetsDir = __dirname;
const snippetFiles = fs
  .readdirSync(snippetsDir)
  .filter((file) => file.endsWith(".mdx") && !file.includes("README"))
  .map((file) => path.join(snippetsDir, file));

console.log("🔍 Validating snippet files...");

let hasErrors = false;

snippetFiles.forEach((filePath) => {
  const fileName = path.basename(filePath);
  const content = fs.readFileSync(filePath, "utf8");

  // Find all variables in the format {{variable_name}}
  const variables = content.match(/\{\{([^}]+)\}\}/g) || [];

  if (variables.length > 0) {
    console.log(`📄 ${fileName}:`);
    variables.forEach((variable) => {
      const varName = variable.replace(/[{}]/g, "");
      console.log(`  - ${varName}`);
    });
    console.log("");
  }
});

// Check if PostHog cookbook uses the snippets correctly
const posthogCookbook = path.join(
  __dirname,
  "../guides/posthog-github-continuous-ai.mdx",
);
if (fs.existsSync(posthogCookbook)) {
  const content = fs.readFileSync(posthogCookbook, "utf8");
  const snippetUsages = content.match(/<Snippet\s+file="([^"]+)"/g) || [];

  if (snippetUsages.length > 0) {
    console.log("✅ PostHog cookbook uses these snippets:");
    snippetUsages.forEach((usage) => {
      const fileName = usage.match(/file="([^"]+)"/)[1];
      console.log(`  - ${fileName}`);
    });
  } else {
    console.log("⚠️  PostHog cookbook does not use any snippets");
    hasErrors = true;
  }
} else {
  console.log("❌ PostHog cookbook not found");
  hasErrors = true;
}

console.log(
  "\n" +
    (hasErrors
      ? "❌ Validation completed with issues"
      : "✅ Validation completed successfully"),
);
process.exit(hasErrors ? 1 : 0);
