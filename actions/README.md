# Continue PR Review Actions

GitHub Actions that provide automated code reviews for pull requests using Continue CLI.

## Available Actions

This repository provides two GitHub Actions for different review styles:

### 1. General Review Action

Provides high-level PR assessment with overall feedback and recommendations.

- **Path:** `continuedev/continue/actions/general-review@<commit-sha>`
- **Trigger:** `@continue-general-review`
- **Output:** Summary comment with strengths, issues, and recommendations

### 2. Detailed Review Action

Provides line-by-line inline comments on specific code changes.

- **Path:** `continuedev/continue/actions/detailed-review@<commit-sha>`
- **Trigger:** `@continue-detailed-review`
- **Output:** Inline review comments on specific lines of code

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

Both actions accept the same inputs:

| Input              | Description                            | Required |
| ------------------ | -------------------------------------- | -------- |
| `continue-api-key` | API key for Continue service           | Yes      |
| `continue-org`     | Organization for Continue config       | Yes      |
| `continue-config`  | Config path (e.g., "myorg/review-bot") | Yes      |

## Setup Requirements

### 1. Continue API Key

Add your Continue API key as a secret named `CONTINUE_API_KEY` in your repository:

1. Go to your repository's Settings
2. Navigate to Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `CONTINUE_API_KEY`
5. Value: Your Continue API key

### 2. Continue Configuration

Set up your review bot configuration in Continue:

1. Create a configuration for your organization
2. Configure the review bot settings
3. Note your organization name and config path

### 3. Workflow Permissions

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
