# Continue PR Review Actions

GitHub Actions that provide automated code reviews for pull requests using Continue CLI.

## Available Actions

This repository provides a GitHub Action for automated PR reviews:

### General Review Action

Provides high-level PR assessment with overall feedback and recommendations.

- **Path:** `continuedev/continue/actions/general-review@main`
- **Trigger:** `@continue-review`
- **Output:** Summary comment with strengths, issues, and recommendations

## Quick Start

### Setting up General Review

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
      - uses: continuedev/continue/actions/general-review@main
        with:
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-org: "your-org-name"
          continue-config: "your-org-name/review-bot"
```

## Inputs

The action accepts the following inputs:

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

The action can be triggered in two ways:

### Automatic Triggers

- When a PR is opened by a team member (OWNER, MEMBER, or COLLABORATOR)
- When a PR is marked as "ready for review" by a team member

### Manual Triggers

Team members can trigger reviews by commenting on any pull request:

- `@continue-review` - Triggers a review

## Review Output

The general review provides a structured comment that includes:

- **Strengths**: What was done well in the PR
- **Issues Found**: Categorized by severity (Critical, High, Medium, Low)
- **Suggestions**: Improvement recommendations
- **Overall Assessment**: Final recommendation (APPROVE, REQUEST_CHANGES, or COMMENT)

## How It Works

1. Checks out repository code
2. Fetches PR diff using GitHub CLI
3. Generates a comprehensive review prompt
4. Runs Continue CLI with specified configuration
5. Posts review as a PR comment

## Versioning

We recommend using the main branch:

- `@main` - Uses the latest code from the main branch

Example:

```yaml
uses: continuedev/continue/actions/general-review@main
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

## Support

For issues or questions:

- [Continue Documentation](https://docs.continue.dev)
- [GitHub Issues](https://github.com/continuedev/continue/issues)
- [Discord Community](https://discord.gg/vapESyrFmJ)
