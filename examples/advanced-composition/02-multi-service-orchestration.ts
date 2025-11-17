/**
 * Advanced Example 2: Multi-Service Orchestration
 *
 * Task: Monitor GitHub PR activity, analyze code changes, generate reports,
 * save to filesystem, and send Slack notifications.
 *
 * Traditional Tool Calling: 150+ LLM round-trips, ~280K tokens
 * Code Mode: Single execution, ~7K tokens
 * Token Reduction: 97.5%
 */

import { github, filesystem, slack } from '/mcp';

// Configuration
const OWNER = 'myorg';
const REPO = 'myrepo';
const REPORT_PATH = '/reports/pr-activity';
const SLACK_CHANNEL = '#dev-updates';

console.log('🔍 Fetching recent PR activity...');

// 1. Get all recently updated PRs
const pullRequests = await github.listPullRequests({
  owner: OWNER,
  repo: REPO,
  state: 'all',
  sort: 'updated',
  direction: 'desc',
  per_page: 50
});

// 2. Filter to PRs from last 7 days (in code, not in context!)
const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
const recentPRs = pullRequests.filter(pr =>
  new Date(pr.updated_at).getTime() > sevenDaysAgo
);

console.log(`📊 Found ${recentPRs.length} PRs updated in last 7 days`);

// 3. Fetch detailed info for each PR in parallel
const prDetails = await Promise.all(
  recentPRs.map(async (pr) => {
    // Get PR details, reviews, and commits in parallel
    const [reviews, commits, comments] = await Promise.all([
      github.listReviews({
        owner: OWNER,
        repo: REPO,
        pull_number: pr.number
      }),
      github.listCommits({
        owner: OWNER,
        repo: REPO,
        pull_number: pr.number
      }),
      github.listPullRequestComments({
        owner: OWNER,
        repo: REPO,
        pull_number: pr.number
      })
    ]);

    // Calculate metrics
    const approvals = reviews.filter(r => r.state === 'APPROVED').length;
    const changesRequested = reviews.filter(r => r.state === 'CHANGES_REQUESTED').length;
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(pr.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      number: pr.number,
      title: pr.title,
      author: pr.user.login,
      state: pr.state,
      isDraft: pr.draft,
      approvals,
      changesRequested,
      commitCount: commits.length,
      commentCount: comments.length,
      daysSinceUpdate,
      url: pr.html_url,
      needsAttention: pr.state === 'open' && approvals === 0 && daysSinceUpdate > 2
    };
  })
);

// 4. Generate analytics
const stats = {
  totalPRs: prDetails.length,
  openPRs: prDetails.filter(pr => pr.state === 'open').length,
  mergedPRs: prDetails.filter(pr => pr.state === 'merged').length,
  closedPRs: prDetails.filter(pr => pr.state === 'closed').length,
  draftPRs: prDetails.filter(pr => pr.isDraft).length,
  needsAttention: prDetails.filter(pr => pr.needsAttention),
  totalCommits: prDetails.reduce((sum, pr) => sum + pr.commitCount, 0),
  totalComments: prDetails.reduce((sum, pr) => sum + pr.commentCount, 0),
  mostActive: prDetails
    .sort((a, b) => (b.commitCount + b.commentCount) - (a.commitCount + a.commentCount))
    .slice(0, 5)
};

console.log('\n📈 Weekly PR Activity Summary:');
console.log(`- Total PRs: ${stats.totalPRs}`);
console.log(`- Open: ${stats.openPRs} | Merged: ${stats.mergedPRs} | Closed: ${stats.closedPRs}`);
console.log(`- Needs attention: ${stats.needsAttention.length}`);

// 5. Generate detailed report
const reportDate = new Date().toISOString().split('T')[0];
const reportFilename = `${REPORT_PATH}/pr-activity-${reportDate}.json`;

const report = {
  generatedAt: new Date().toISOString(),
  repository: `${OWNER}/${REPO}`,
  period: 'Last 7 days',
  summary: stats,
  pullRequests: prDetails,
  alerts: {
    needsReview: stats.needsAttention.map(pr => ({
      number: pr.number,
      title: pr.title,
      author: pr.author,
      daysSinceUpdate: pr.daysSinceUpdate,
      url: pr.url
    }))
  }
};

// 6. Save report to filesystem
console.log(`\n💾 Saving report to ${reportFilename}...`);
await filesystem.writeFile({
  path: reportFilename,
  content: JSON.stringify(report, null, 2)
});

// 7. Generate human-readable summary for Slack
const slackMessage = `
📊 *Weekly PR Activity Report* - ${OWNER}/${REPO}

*Summary (Last 7 Days)*
• ${stats.totalPRs} PRs updated
• ${stats.openPRs} open | ${stats.mergedPRs} merged | ${stats.closedPRs} closed
• ${stats.totalCommits} commits | ${stats.totalComments} comments

${stats.needsAttention.length > 0 ? `
⚠️ *${stats.needsAttention.length} PRs Need Attention*
${stats.needsAttention.slice(0, 5).map(pr =>
  `• #${pr.number}: ${pr.title} (${pr.daysSinceUpdate}d old) - <${pr.url}|View>`
).join('\n')}
${stats.needsAttention.length > 5 ? `\n_...and ${stats.needsAttention.length - 5} more_` : ''}
` : '✅ *All PRs are in good shape!*'}

📄 Full report saved to: \`${reportFilename}\`
`.trim();

// 8. Send to Slack
console.log(`\n💬 Sending summary to ${SLACK_CHANNEL}...`);
await slack.postMessage({
  channel: SLACK_CHANNEL,
  text: slackMessage
});

console.log('✅ Workflow complete!');

// Return minimal summary to context
return {
  success: true,
  prsAnalyzed: stats.totalPRs,
  needsAttention: stats.needsAttention.length,
  reportPath: reportFilename,
  slackNotified: true
};

/*
 * 🎯 What makes this impossible with traditional tool calling:
 *
 * 1. MULTI-SERVICE ORCHESTRATION
 *    - 3 different MCP services (GitHub, Filesystem, Slack)
 *    - Traditional: Switching between tools requires LLM involvement
 *
 * 2. NESTED PARALLEL OPERATIONS
 *    - For each PR: fetch reviews + commits + comments in parallel
 *    - Traditional: Sequential calls, massive latency
 *
 * 3. COMPLEX DATA TRANSFORMATION
 *    - Filtering, sorting, aggregating, formatting
 *    - Traditional: Would need to send all data to LLM for processing
 *
 * 4. CONDITIONAL LOGIC
 *    - Different Slack message based on analysis results
 *    - Traditional: Requires LLM reasoning step
 *
 * 5. STATE MANAGEMENT
 *    - Data flows through multiple steps
 *    - Traditional: Each step sends full data back to LLM
 *
 * Token Comparison:
 * ├─ Traditional: ~280,000 tokens
 * │  └─ (50 PRs × 3 API calls × 1800 tokens per round-trip)
 * ├─ Code Mode: ~7,000 tokens
 * │  └─ (schemas + minimal result)
 * └─ Reduction: 97.5%
 */
