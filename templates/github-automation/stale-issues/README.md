# Stale Issue Manager

Automatically identifies and labels inactive issues in your GitHub repositories.

## Overview

This template helps you maintain a clean issue tracker by automatically identifying issues that haven't been updated in a specified number of days. It labels them as "stale" and posts a comment to prompt contributors to provide updates.

## Features

- 🔍 Scans all repositories in your organization
- ⏰ Configurable staleness threshold (default: 30 days)
- 🏷️ Automatically applies custom label to stale issues
- 💬 Posts customizable comment on stale issues
- 🔄 Retry logic for rate limiting
- 📊 Detailed execution summary

## Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `GITHUB_ORG` | string | Yes | - | GitHub organization name |
| `STALE_DAYS` | number | No | 30 | Days before marking an issue as stale |
| `STALE_LABEL` | string | No | "stale" | Label to apply to stale issues |
| `COMMENT_MESSAGE` | string | No | Default message | Custom message to post on stale issues |

## Example Usage

### Recommended Schedule

Run this workflow daily at 9 AM:

```cron
0 9 * * *
```

### Example Configuration

```json
{
  "GITHUB_ORG": "myorganization",
  "STALE_DAYS": 45,
  "STALE_LABEL": "needs-attention",
  "COMMENT_MESSAGE": "This issue hasn't been updated in 45 days. Please provide an update or we'll close it soon."
}
```

## Output

The workflow returns a summary object:

```json
{
  "success": true,
  "repositoriesAnalyzed": 12,
  "staleIssuesFound": 15,
  "staleIssuesUpdated": 15,
  "timestamp": "2025-11-18T09:00:00.000Z"
}
```

## Required Permissions

This template requires the following GitHub permissions:

- `repo:issues:write` - To add labels and comments to issues

## Use Cases

1. **Maintain Clean Issue Tracker**: Automatically identify abandoned issues
2. **Prompt Contributors**: Remind issue authors to provide updates
3. **Free Maintainer Time**: Reduce manual issue triage work
4. **Project Management**: Keep backlog organized and actionable

## Token Efficiency

- **Estimated tokens**: ~6,000
- **Token reduction**: 98%
- **Estimated duration**: 45 seconds

Compare this to manually reviewing issues or using GitHub Actions which would require:
- Multiple API calls per issue
- Complex workflow configuration
- Higher token usage for context

## Best Practices

1. **Start with longer staleness period**: Begin with 60-90 days and adjust based on your team's workflow
2. **Customize the message**: Make it friendly and actionable
3. **Run during low-activity hours**: Schedule for times when fewer team members are active
4. **Monitor the first run**: Check the results of the first execution to ensure it behaves as expected

## Error Handling

This template includes:

- Automatic retry logic for rate limiting
- Graceful error handling per repository
- Continues execution even if one repository fails
- Detailed error logging

## Troubleshooting

### Issue: Rate Limiting

If you hit GitHub's rate limit:
- The template will automatically retry with exponential backoff
- Consider reducing the number of repositories or running less frequently

### Issue: No Issues Being Labeled

Check:
- The `STALE_DAYS` configuration is appropriate
- Your GitHub token has the required permissions
- Issues aren't already labeled with the stale label

### Issue: Too Many Issues Labeled

- Increase `STALE_DAYS` value
- Review your team's issue update process
- Consider excluding certain repositories or issue types

## Extending This Template

You can customize this template to:

- Close issues after being stale for additional time
- Exclude issues with certain labels
- Send notifications to Slack when stale issues are found
- Generate a report of stale issues

## License

Apache 2.0 - Code Mode Team
