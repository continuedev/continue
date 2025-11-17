/**
 * Advanced Example 1: Parallel Batch Operations
 *
 * Task: Analyze multiple GitHub repositories in parallel, find stale issues,
 * and batch-update them with labels and comments.
 *
 * Traditional Tool Calling: 200+ LLM round-trips, ~350K tokens
 * Code Mode: Single execution, ~6K tokens
 * Token Reduction: 98.3%
 */

import { github } from '/mcp';

// Configuration
const ORG = 'myorg';
const STALE_DAYS = 30;
const REPOS_TO_CHECK = ['repo1', 'repo2', 'repo3', 'repo4', 'repo5'];

async function analyzeRepository(repoName: string) {
  console.log(`📊 Analyzing ${repoName}...`);

  // Get all open issues for this repo
  const issues = await github.listIssues({
    owner: ORG,
    repo: repoName,
    state: 'open'
  });

  // Filter in CODE (not in context!) - huge token savings
  const now = Date.now();
  const staleIssues = issues.filter(issue => {
    const daysSinceUpdate = (now - new Date(issue.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > STALE_DAYS && !issue.labels.some(l => l.name === 'stale');
  });

  return {
    repo: repoName,
    totalIssues: issues.length,
    staleIssues: staleIssues.map(i => ({
      number: i.number,
      title: i.title,
      daysSinceUpdate: Math.floor((now - new Date(i.updated_at).getTime()) / (1000 * 60 * 60 * 24))
    }))
  };
}

// ⚡ PARALLEL EXECUTION - fetch all repos simultaneously
const results = await Promise.all(
  REPOS_TO_CHECK.map(repo => analyzeRepository(repo))
);

// Aggregate results
const allStaleIssues = results.flatMap(r =>
  r.staleIssues.map(issue => ({
    repo: r.repo,
    ...issue
  }))
);

console.log(`\n📈 Summary:`);
console.log(`- Repositories analyzed: ${results.length}`);
console.log(`- Total open issues: ${results.reduce((sum, r) => sum + r.totalIssues, 0)}`);
console.log(`- Stale issues found: ${allStaleIssues.length}`);

// 🔄 BATCH UPDATE - update all stale issues in parallel
if (allStaleIssues.length > 0) {
  console.log(`\n🏷️  Adding 'stale' label to ${allStaleIssues.length} issues...`);

  await Promise.all(
    allStaleIssues.map(async (issue) => {
      // Add label
      await github.addLabels({
        owner: ORG,
        repo: issue.repo,
        issue_number: issue.number,
        labels: ['stale']
      });

      // Add comment explaining why
      await github.createComment({
        owner: ORG,
        repo: issue.repo,
        issue_number: issue.number,
        body: `🤖 This issue hasn't been updated in ${issue.daysSinceUpdate} days and has been marked as stale.\n\nIf this is still relevant, please comment or update the issue to remove the stale label.`
      });
    })
  );

  console.log(`✅ Updated ${allStaleIssues.length} issues`);
}

// Return structured summary (minimal tokens back to context)
return {
  repositoriesAnalyzed: results.length,
  totalOpenIssues: results.reduce((sum, r) => sum + r.totalIssues, 0),
  staleIssuesFound: allStaleIssues.length,
  staleIssuesUpdated: allStaleIssues.length,
  breakdown: results.map(r => ({
    repo: r.repo,
    openIssues: r.totalIssues,
    staleCount: r.staleIssues.length
  }))
};

/*
 * 🎯 What makes this impossible with traditional tool calling:
 *
 * 1. PARALLEL EXECUTION
 *    - 5 repos analyzed simultaneously
 *    - Traditional: 5 sequential LLM calls → 5x slower
 *
 * 2. IN-CODE FILTERING
 *    - Hundreds of issues filtered in code
 *    - Traditional: All issues sent to LLM context → massive token waste
 *
 * 3. BATCH OPERATIONS
 *    - All labels/comments added in parallel
 *    - Traditional: One LLM round-trip per issue → 100+ calls
 *
 * 4. COMPLEX LOGIC
 *    - Date calculations, filtering, aggregation
 *    - Traditional: Would require multiple LLM reasoning steps
 *
 * Token Comparison:
 * ├─ Traditional: ~350,000 tokens
 * │  └─ (5 repos × 50 issues × 1400 tokens per round-trip)
 * ├─ Code Mode: ~6,000 tokens
 * │  └─ (schemas + minimal result summary)
 * └─ Reduction: 98.3%
 */
