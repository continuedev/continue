# Continue PR Review Actions

GitHub Actions that provide automated code reviews for pull requests using Continue CLI.

## Available Actions

This repository provides three GitHub Actions for automated code reviews:

### 1. Base Review Action (Recommended)

Zero-config AI code review that automatically handles both general and detailed reviews.

- **Path:** `continuedev/continue/actions/base-review@main`
- **Trigger:** `@continue-agent` (with optional custom instructions)
- **Output:** Comprehensive review with inline comments

### 2. General Review Action

Provides high-level PR assessment with overall feedback and recommendations.

- **Path:** `continuedev/continue/actions/general-review@main`
- **Trigger:** `@continue-general-review`
- **Output:** Summary comment with strengths, issues, and recommendations

### 3. Detailed Review Action

Provides line-by-line inline comments on specific code changes.

- **Path:** `continuedev/continue/actions/detailed-review@main`
- **Trigger:** `@continue-detailed-review`
- **Output:** Inline review comments on specific lines of code

## Quick Start

### Zero-Config Setup (Recommended)

The simplest way to add AI code reviews to your repository:

```yaml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  issues: write
  actions: read
  checks: write

jobs:
  review:
    # Only run on PRs or when @continue-agent is mentioned
    if: |
      github.event_name == 'pull_request' || 
      (github.event_name == 'issue_comment' && 
       github.event.issue.pull_request && 
       contains(github.event.comment.body, '@continue-agent'))
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: continuedev/continue/actions/base-review@main
        with:
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
```

### With GitHub App (For Bot Identity)

```yaml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  issues: write
  actions: read
  checks: write

jobs:
  review:
    if: |
      github.event_name == 'pull_request' || 
      (github.event_name == 'issue_comment' && 
       github.event.issue.pull_request && 
       contains(github.event.comment.body, '@continue-agent'))
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate GitHub App Token
        id: app-token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ secrets.CONTINUE_APP_ID }}
          private-key: ${{ secrets.CONTINUE_APP_PRIVATE_KEY }}

      - uses: continuedev/continue/actions/base-review@main
        with:
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          github-token: ${{ steps.app-token.outputs.token }}
```

### With Custom Configuration

```yaml
- uses: continuedev/continue/actions/base-review@main
  with:
    continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
    continue-org: "your-org-name"
    continue-config: "your-org-name/custom-review-bot"
```

## Usage Examples

### Basic Usage

#### Automatic Review on PR

When a PR is opened or marked ready for review, the Continue Agent will automatically perform a code review.

#### Manual Trigger with @mention

Comment on any PR with:

```
@continue-agent
```

#### Request Detailed Review

```
@continue-agent detailed
```

### Custom Review Focus

You can provide specific instructions after the @mention:

```
@continue-agent please focus on security implications and performance
```

```
@continue-agent check if this follows our team's React best practices
```

```
@continue-agent detailed review the error handling and edge cases
```

## Security Features

### Multi-Layer Security

1. **Workflow-level filtering**: The workflow only runs when:

   - It's a PR event (opened, synchronized, ready_for_review)
   - It's a comment on a PR that contains `@continue-agent`

2. **Action-level authorization**: Only authorized users (OWNER, MEMBER, COLLABORATOR) can trigger reviews

3. **Input sanitization**: Custom prompts are:
   - Read as data, not executed as code
   - Written to temporary files to prevent injection
   - Passed through environment variables safely

### How Custom Prompts Work

When you comment `@continue-agent [your custom instructions]`, the action:

1. Extracts the text after `@continue-agent`
2. Sanitizes it by treating it as data (no shell execution)
3. Passes it to the review action as additional context
4. The AI incorporates your instructions into its review

This allows flexible, context-aware reviews while maintaining security.

## Quick Start

### Using Both Actions Together

```yaml
name: PR Reviews
on:
  pull_request:
    types: [opened, ready_for_review]
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  general-review:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: continuedev/continue/actions/general-review@<commit-sha>
        with:
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-org: "your-org-name"
          continue-config: "your-org-name/review-bot"

  detailed-review:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: continuedev/continue/actions/detailed-review@<commit-sha>
        with:
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-org: "your-org-name"
          continue-config: "your-org-name/review-bot"
```

### General Review Only

```yaml
name: PR General Review
on:
  pull_request:
    types: [opened, ready_for_review]
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  review:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: continuedev/continue/actions/general-review@<commit-sha>
        with:
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-org: "your-org-name"
          continue-config: "your-org-name/review-bot"
```

### Detailed Review Only

```yaml
name: PR Detailed Review
on:
  pull_request:
    types: [opened, ready_for_review]
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  review:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: continuedev/continue/actions/detailed-review@<commit-sha>
        with:
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-org: "your-org-name"
          continue-config: "your-org-name/review-bot"
```

## Inputs

### Base Review Action

| Input              | Description                            | Required | Default                  |
| ------------------ | -------------------------------------- | -------- | ------------------------ |
| `continue-api-key` | API key for Continue service           | Yes      | -                        |
| `continue-org`     | Organization for Continue config       | No       | `continuedev`            |
| `continue-config`  | Config path (e.g., "myorg/review-bot") | No       | `continuedev/review-bot` |
| `use_github_app`   | Use GitHub App for bot identity        | No       | `true`                   |
| `app-id`           | GitHub App ID                          | No       | `1090372`                |
| `app-private-key`  | GitHub App Private Key                 | No       | -                        |
| `github-token`     | GitHub token for API access            | No       | -                        |

### General and Detailed Review Actions

Both actions accept the same inputs:

| Input              | Description                                    | Required | Default |
| ------------------ | ---------------------------------------------- | -------- | ------- |
| `continue-api-key` | API key for Continue service                   | Yes      | -       |
| `continue-org`     | Organization for Continue config               | Yes      | -       |
| `continue-config`  | Config path (e.g., "myorg/review-bot")         | Yes      | -       |
| `use_github_app`   | Use Continue Agent GitHub App for bot identity | No       | `true`  |

## Setup Requirements

### 1. Continue API Key (Required)

Add your Continue API key as a secret named `CONTINUE_API_KEY` in your repository:

1. Go to your repository's Settings
2. Navigate to Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `CONTINUE_API_KEY`
5. Value: Your Continue API key

### 2. Continue Agent GitHub App (Recommended)

To enable reviews with the `continue-agent[bot]` identity instead of `github-actions[bot]`:

#### Option A: Install the Continue Agent App

1. **Install the app**: Visit https://github.com/apps/continue-agent
2. **Grant repository access**: Select the repositories where you want to use Continue reviews
3. **Configure secrets and variables**:
   - Add a **repository secret**: `CONTINUE_APP_PRIVATE_KEY`
     - This should contain your GitHub App's private key (the entire .pem file content)
   - Add a **repository variable**: `CONTINUE_APP_ID`
     - This should contain your GitHub App's ID

#### Option B: Use without GitHub App

If you prefer to use the standard `github-actions[bot]` identity, add this to your workflow:

```yaml
- uses: continuedev/continue/actions/general-review@main
  with:
    continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
    continue-org: "your-org-name"
    continue-config: "your-org-name/review-bot"
    use_github_app: false # Disable GitHub App integration
```

#### Benefits of Using the GitHub App

- ✅ **Branded Identity**: Reviews appear as `continue-agent[bot]` with custom avatar
- ✅ **Better Rate Limits**: App rate limits scale with repository count
- ✅ **Professional Appearance**: Distinctive bot identity for your reviews
- ✅ **Enhanced Security**: Short-lived tokens (1 hour expiry) with automatic revocation

### 3. Continue Configuration

Set up your review bot configuration in Continue:

1. Create a configuration for your organization
2. Configure the review bot settings
3. Note your organization name and config path

### 4. Workflow Permissions

The workflow requires these permissions:

- `contents: read` - To checkout and read repository code
- `pull-requests: write` - To post review comments on PRs
- `issues: write` - To respond to comment triggers

## Triggering Reviews

Both actions can be triggered in two ways:

### Automatic Triggers

- When a PR is opened by a team member (OWNER, MEMBER, or COLLABORATOR)
- When a PR is marked as "ready for review" by a team member

### Manual Triggers

Team members can trigger reviews by commenting on any pull request:

- `@continue-general-review` - Triggers a general review
- `@continue-detailed-review` - Triggers a detailed inline review

## Review Outputs

### General Review Output

The general review provides a structured comment that includes:

- **Strengths**: What was done well in the PR
- **Issues Found**: Categorized by severity (Critical, High, Medium, Low)
- **Suggestions**: Improvement recommendations
- **Overall Assessment**: Final recommendation (APPROVE, REQUEST_CHANGES, or COMMENT)

### Detailed Review Output

The detailed review provides:

- **Inline Comments**: Specific feedback on individual lines of code
- **Position Markers**: Comments appear directly on the changed lines
- **Review Summary**: Overall assessment of the changes
- **Actionable Feedback**: Specific suggestions for each issue found

## How It Works

### General Review Process

1. Checks out repository code
2. Fetches PR diff using GitHub CLI
3. Generates a comprehensive review prompt
4. Runs Continue CLI with specified configuration
5. Posts review as a PR comment

### Detailed Review Process

1. Checks out repository code
2. Fetches PR diff with GitHub API positions
3. Annotates diff with position markers
4. Generates inline review prompt
5. Runs Continue CLI for detailed analysis
6. Posts inline comments using GitHub's review API

## Versioning

We recommend using a specific commit SHA for stability and predictability:

- `@<commit-sha>` - Pins to a specific commit for maximum stability (recommended)
- `@main` - Uses the latest code from the main branch (for bleeding edge)
- `@v1` - Uses a version tag when available

Example:

```yaml
uses: continuedev/continue/actions/general-review@64bda6b2b3dac1037e9895dbee4ce1d35565e1fe
```

## Troubleshooting

### GitHub App Installation Issues

#### Error: "Continue Agent GitHub App is not installed or configured properly"

This error means the GitHub App token could not be generated. Common causes:

1. **App not installed**: Visit https://github.com/apps/continue-agent and install it
2. **Missing secrets/variables**: Ensure you've added:
   - Secret: `CONTINUE_APP_PRIVATE_KEY` (the entire .pem file content)
   - Variable: `CONTINUE_APP_ID` (your app's ID number)
3. **No repository access**: Check that the app has access to your repository
4. **Incorrect private key format**: Make sure you include the full private key with headers:
   ```
   -----BEGIN RSA PRIVATE KEY-----
   [key content]
   -----END RSA PRIVATE KEY-----
   ```

**Quick fix**: Set `use_github_app: false` in your workflow to bypass app authentication

### Review not triggering

- Ensure the PR author or commenter has appropriate permissions (OWNER, MEMBER, or COLLABORATOR)
- Check that the workflow file is in the default branch
- Verify the Continue API key is correctly set as a repository secret

### No review output generated

- Check the action logs for any errors
- Verify your Continue configuration is correct
- Ensure your Continue API key is valid

### Inline comments not appearing (Detailed Review)

- Check that the PR has a valid diff
- Verify GitHub API permissions are correct
- Review action logs for position calculation errors

## Support

For issues or questions:

- [Continue Documentation](https://docs.continue.dev)
- [GitHub Issues](https://github.com/continuedev/continue/issues)
- [Discord Community](https://discord.gg/vapESyrFmJ)
