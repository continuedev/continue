const fs = require("fs");
const path = require("path");

const messages = {
  missing_api_key: `## Code Review Summary

⚠️ AI review skipped: CONTINUE_API_KEY not configured.

### Configuration Required
- Please set the CONTINUE_API_KEY secret in repository settings
- Verify that the organization and config path are valid
`,
  cli_install_failed: `## Code Review Summary

⚠️ AI review skipped: Continue CLI installation failed.

### Troubleshooting
- Check that npm installation succeeded
- Verify @continuedev/cli package is available
`,
  empty_output: `## Code Review Summary

⚠️ Continue CLI returned an empty response. Please check the configuration.
`,
  cli_not_found: `## Code Review Summary

⚠️ Continue CLI is not properly installed. Please ensure @continuedev/cli is installed globally.
`,
  config_error: `## Code Review Summary

⚠️ Continue configuration error. Please verify that the assistant exists in Continue Hub.
`,
  auth_error: `## Code Review Summary

⚠️ Continue API authentication failed. Please check your CONTINUE_API_KEY.
`,
  generic_failure: `## Code Review Summary

⚠️ AI review failed. Please check the Continue API key and configuration.

### Troubleshooting
- Verify the CONTINUE_API_KEY secret is set correctly
- Check that the organization and config path are valid
- Ensure the Continue service is accessible
`,
};

function main() {
  const [outputPath, messageKey] = process.argv.slice(2);

  if (!outputPath || !messageKey) {
    console.error("Usage: node writeMarkdown.js <outputPath> <messageKey>");
    process.exit(1);
  }

  const message = messages[messageKey];

  if (!message) {
    console.error(`Unknown message key: ${messageKey}`);
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), outputPath);
  fs.writeFileSync(absolutePath, message, "utf8");
  console.log(`Wrote ${messageKey} message to ${absolutePath}`);
}

main();
