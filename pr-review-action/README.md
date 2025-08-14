# Continue PR Review Action

A GitHub Action that provides automated code review for pull requests using Continue CLI.

## Usage

Add this workflow to your repository at `.github/workflows/pr-review.yml`:

```yaml
name: PR Review
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
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: continuedev/continue/pr-review-action@v1
        with:
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-org: 'your-org-name'
          continue-config: 'your-org-name/review-bot'
```

The action automatically handles authorization checks and only runs for:
- PRs opened or marked ready by team members (OWNER, MEMBER, COLLABORATOR)
- Comments containing `@continue-general-review` from team members

## Inputs

| Input | Description | Required |
|-------|-------------|----------|
| `continue-api-key` | API key for Continue service | Yes |
| `continue-org` | Organization for Continue config | Yes |
| `continue-config` | Config path (e.g., "myorg/review-bot") | Yes |

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

### Manual Trigger
Team members can trigger a review by commenting `@continue-general-review` on any pull request.

## Versioning

This action follows semantic versioning. We recommend using the major version tag for automatic updates:

- `@v1` - Automatically uses the latest v1.x.x release (recommended)
- `@v1.0.0` - Pins to a specific version
- `@main` - Uses the latest code from the main branch (not recommended for production)

## Minimal Example

This is the simplest possible configuration:

```yaml
name: PR Review
on: [pull_request, issue_comment]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: continuedev/continue/pr-review-action@v1
        with:
          continue-api-key: ${{ secrets.CONTINUE_API_KEY }}
          continue-org: 'acme-corp'
          continue-config: 'acme-corp/review-bot'
```

## How It Works

1. The action checks out your repository code
2. Installs the Continue CLI (v1.4.25)
3. Fetches the PR diff using GitHub CLI
4. Generates a comprehensive review prompt
5. Runs the Continue CLI with your specified configuration
6. Posts the review as a comment on the PR

## Review Output

The action generates a structured code review that includes:

- **Strengths**: What was done well in the PR
- **Issues Found**: Categorized by severity (Critical, High, Medium, Low)
- **Suggestions**: Improvement recommendations
- **Overall Assessment**: Final recommendation (APPROVE, REQUEST_CHANGES, or COMMENT)

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