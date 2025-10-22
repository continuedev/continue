# Continue PR Review Bot - Troubleshooting Guide

## Quick Diagnostic Steps

Use the enhanced debug workflow to identify issues:

1. **Copy the diagnostic workflow** to the target repository:

   ```bash
   cp .github/workflows/code-review-debug.yml /path/to/siblings-write/.github/workflows/
   ```

2. **Commit and push** the workflow to trigger it on the next PR

3. **Review the detailed logs** - each step now includes:
   - ✅ Success indicators
   - ❌ Error messages with context
   - 🔍 Debug information
   - 💡 Troubleshooting hints

## Common Issues and Solutions

### 1. Missing or Invalid API Key

**Symptoms:**

- Exit code 1
- Authentication failures
- "API key not found" errors

**Solution:**

```bash
# 1. Get a fresh API key
# Visit: https://hub.continue.dev/settings/api-keys

# 2. Add to repository secrets
# Go to: Repository Settings → Secrets and variables → Actions
# Create secret: CONTINUE_API_KEY
# Paste your key (starts with "cnt_...")
```

### 2. Assistant Not Found

**Symptoms:**

- "Config not found" errors
- "continuedev/code-reviewer" not accessible

**Solution:**

- Option A: Use the default assistant by removing `--config` flag
- Option B: Create your own assistant at hub.continue.dev
- Option C: Use a different public assistant

**Modify the workflow:**

```yaml
# Instead of:
cn --config continuedev/code-reviewer -p "$PROMPT" --auto

# Try:
cn -p "$PROMPT" --auto  # Uses default assistant
# OR
cn --config your-username/your-assistant -p "$PROMPT" --auto
```

### 3. CLI Installation Failures

**Symptoms:**

- npm install errors
- "cn command not found"

**Solution:**
The debug workflow checks:

- CLI installation success
- CLI version
- Command availability

If this fails, check:

- Network connectivity in GitHub Actions
- npm registry access
- Node.js version compatibility

### 4. GitHub Permissions

**Symptoms:**

- Cannot post comments
- Cannot read PR details

**Solution:**
Ensure workflow has correct permissions:

```yaml
permissions:
  contents: read
  pull-requests: write
  issues: write
```

## Debug Workflow Features

The diagnostic workflow (`code-review-debug.yml`) includes:

### Enhanced Validation

- ✅ Validates API key presence before running
- ✅ Checks CLI installation and version
- ✅ Verifies PR data fetching
- ✅ Lists changed files for transparency

### Better Error Messages

- Detailed error context with exit codes
- Troubleshooting hints inline
- Common issue checklists
- Links to relevant documentation

### Debug Artifacts

Uploads artifacts on every run (even failures):

- `pr.diff` - The PR changes
- `changed_files.txt` - List of modified files
- `review_output.md` - Continue CLI output

**Access artifacts:**

- Go to Actions → Workflow run → Artifacts section
- Download "review-debug-artifacts.zip"

## Step-by-Step Debugging Process

1. **Run the debug workflow** on a test PR

2. **Check each step's output:**

   - Look for ❌ error indicators
   - Read the specific error messages
   - Follow the inline troubleshooting hints

3. **Common failure points (in order):**

   - [ ] API key validation (Step: Validate Continue API Key)
   - [ ] CLI installation (Step: Install Continue CLI)
   - [ ] CLI verification (Step: Verify Continue CLI Installation)
   - [ ] PR data fetching (Step: Get PR Details)
   - [ ] Continue review execution (Step: Run Continue Review)
   - [ ] Comment posting (Step: Post Review Comment)

4. **Download artifacts** to inspect:
   - Review the exact prompt sent to Continue
   - Check the PR diff format
   - Verify changed files list

## Testing the Fix

After applying fixes:

1. Create a test PR or comment `@review-bot check for syntax errors`
2. Monitor the workflow run in real-time
3. Look for all ✅ indicators
4. Verify the review comment appears on the PR

## Additional Resources

- Continue Documentation: https://docs.continue.dev/guides/github-pr-review-bot
- Continue Hub: https://hub.continue.dev
- API Keys: https://hub.continue.dev/settings/api-keys
- CLI Repository: https://github.com/continuedev/continue/tree/main/packages/cli

## Need More Help?

If the debug workflow still shows errors:

1. **Check the Continue CLI logs** in the artifact download
2. **Verify your Continue Hub account** has active credits/access
3. **Test the API key locally:**
   ```bash
   export CONTINUE_API_KEY="your_key_here"
   echo "test" | cn -p "Review this text" --auto
   ```
4. **Open an issue** with the debug workflow output attached
