const fs = require("fs");
const path = require("path");

function main() {
  const prNumber = process.argv[2];
  if (!prNumber) {
    console.error(
      "buildPrompt.js requires the PR number as the first argument",
    );
    process.exit(1);
  }

  const prDataPath = path.resolve(process.cwd(), "pr_data.json");
  const prDiffPath = path.resolve(process.cwd(), "pr_diff.txt");
  const outputPath = path.resolve(process.cwd(), "review_prompt.txt");

  if (!fs.existsSync(prDataPath)) {
    console.error(`Missing PR metadata file: ${prDataPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(prDiffPath)) {
    console.error(`Missing PR diff file: ${prDiffPath}`);
    process.exit(1);
  }

  const repo = process.env.GITHUB_REPOSITORY || "unknown-repo";
  let prData;

  try {
    prData = JSON.parse(fs.readFileSync(prDataPath, "utf8"));
  } catch (error) {
    console.error("Failed to parse PR metadata JSON:", error);
    process.exit(1);
  }

  const filesChanged = Array.isArray(prData.files) ? prData.files.length : 0;
  const authorLogin = prData.author?.login || "unknown-author";
  const title = prData.title || "Untitled";
  const prBody =
    prData.body && prData.body.trim()
      ? prData.body.trim()
      : "No description provided";
  const diff = fs.readFileSync(prDiffPath, "utf8");

  const promptSections = [
    "You are reviewing a pull request. Please provide helpful, context-aware feedback.",
    "",
    "CONTEXT:",
    `- Repository: ${repo}`,
    `- PR #${prNumber}: ${title}`,
    `- Files Changed: ${filesChanged}`,
    `- Author: ${authorLogin}`,
    "",
    "REVIEW APPROACH:",
    "1. First, understand what this PR is trying to accomplish",
    "2. Check if similar patterns exist elsewhere in the codebase",
    "3. Focus on actual issues that affect functionality",
    "4. Be constructive and suggest solutions when possible",
    "",
    "FOCUS ON:",
    "- Bugs that will cause failures or incorrect behavior",
    "- Security vulnerabilities (exposed secrets, injection risks)",
    "- Breaking changes that affect other parts of the system",
    "- Performance issues with real impact (memory leaks, O(n²) algorithms)",
    "- Missing tests for new features or bug fixes",
    "- Missing documentation for APIs or complex logic",
    "",
    "SKIP COMMENTING ON:",
    "- Style and formatting (handled by linters)",
    "- Alternative approaches unless current is broken",
    "- Minor naming unless genuinely confusing",
    "- Trivial documentation for self-explanatory code",
    "",
    "Be specific with line numbers and explain why something is an issue.",
    "",
    `PR Description: ${prBody}`,
    "",
    "Code Changes:",
    diff.trimEnd(),
    "",
    "Your Review:",
    "Please provide constructive feedback on the code changes.",
    "Focus on issues that matter for functionality, security, and maintainability.",
    "If the code looks good overall, acknowledge that while noting any minor suggestions.",
  ];

  const prompt = `${promptSections.join("\n")}\n`;

  fs.writeFileSync(outputPath, prompt, "utf8");
  console.log(`Wrote review prompt to ${outputPath}`);
}

main();
