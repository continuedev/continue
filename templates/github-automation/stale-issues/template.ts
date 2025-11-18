/**
 * Template: Stale Issue Manager
 * Category: github-automation
 * Description: Auto-label and comment on inactive issues
 *
 * @config GITHUB_ORG - GitHub organization name (required)
 * @config STALE_DAYS - Days before marking stale (default: 30)
 * @config STALE_LABEL - Label to apply to stale issues (default: stale)
 * @config COMMENT_MESSAGE - Message to post on stale issues
 *
 * @mcp github
 * @trigger cron
 *
 * @example
 * // Returns:
 * {
 *   repositoriesAnalyzed: 5,
 *   staleIssuesFound: 23,
 *   staleIssuesUpdated: 23
 * }
 */

import { github } from '/mcp';

// ============================================================
// CONFIGURATION
// ============================================================

const GITHUB_ORG = process.env.GITHUB_ORG || '';
const STALE_DAYS = parseInt(process.env.STALE_DAYS || '30');
const STALE_LABEL = process.env.STALE_LABEL || 'stale';
const COMMENT_MESSAGE = process.env.COMMENT_MESSAGE ||
  'This issue has been automatically marked as stale because it has not had recent activity. ' +
  'Please update the issue or it will be closed soon.';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check if an issue is stale based on last update time
 */
function isStale(updatedAt: string, staleDays: number): boolean {
  const lastUpdate = new Date(updatedAt);
  const now = new Date();
  const daysSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceUpdate >= staleDays;
}

/**
 * Retry a function with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries === 0) throw error;

    // Check if error is rate limit
    if (error.code === 'RATE_LIMIT') {
      console.log(`⏳ Rate limited, waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }

    throw error;
  }
}

// ============================================================
// MAIN WORKFLOW
// ============================================================

async function main() {
  console.log('🚀 Starting Stale Issue Manager workflow...');
  console.log(`📋 Configuration:
  - Organization: ${GITHUB_ORG}
  - Stale after: ${STALE_DAYS} days
  - Label: ${STALE_LABEL}
`);

  if (!GITHUB_ORG) {
    throw new Error('GITHUB_ORG environment variable is required');
  }

  let repositoriesAnalyzed = 0;
  let staleIssuesFound = 0;
  let staleIssuesUpdated = 0;

  try {
    // Step 1: Get all repositories in the organization
    console.log('📦 Fetching repositories...');
    const repositories = await withRetry(() =>
      github.listRepositories({
        org: GITHUB_ORG,
        per_page: 100
      })
    );

    console.log(`✅ Found ${repositories.length} repositories`);

    // Step 2: Process each repository
    for (const repo of repositories) {
      console.log(`\n🔍 Analyzing ${repo.name}...`);
      repositoriesAnalyzed++;

      try {
        // Get all open issues for this repository
        const issues = await withRetry(() =>
          github.listIssues({
            owner: GITHUB_ORG,
            repo: repo.name,
            state: 'open',
            per_page: 100
          })
        );

        console.log(`  Found ${issues.length} open issues`);

        // Step 3: Check each issue for staleness
        for (const issue of issues) {
          // Skip if already labeled as stale
          if (issue.labels?.some((label: any) => label.name === STALE_LABEL)) {
            continue;
          }

          // Check if issue is stale
          if (isStale(issue.updated_at, STALE_DAYS)) {
            staleIssuesFound++;
            console.log(`  ⚠️  Issue #${issue.number} is stale (last updated: ${issue.updated_at})`);

            try {
              // Add stale label
              await withRetry(() =>
                github.addLabels({
                  owner: GITHUB_ORG,
                  repo: repo.name,
                  issue_number: issue.number,
                  labels: [STALE_LABEL]
                })
              );

              // Add comment
              await withRetry(() =>
                github.createComment({
                  owner: GITHUB_ORG,
                  repo: repo.name,
                  issue_number: issue.number,
                  body: COMMENT_MESSAGE
                })
              );

              staleIssuesUpdated++;
              console.log(`  ✅ Updated issue #${issue.number}`);
            } catch (error: any) {
              console.error(`  ❌ Failed to update issue #${issue.number}:`, error.message);
            }
          }
        }
      } catch (error: any) {
        console.error(`❌ Error processing ${repo.name}:`, error.message);
        // Continue to next repository
        continue;
      }
    }

    // Step 4: Summary
    console.log(`\n📊 Workflow Summary:
  - Repositories analyzed: ${repositoriesAnalyzed}
  - Stale issues found: ${staleIssuesFound}
  - Stale issues updated: ${staleIssuesUpdated}
`);

    console.log('✅ Workflow complete!');

    return {
      success: true,
      repositoriesAnalyzed,
      staleIssuesFound,
      staleIssuesUpdated,
      timestamp: new Date().toISOString()
    };

  } catch (error: any) {
    console.error('❌ Workflow failed:', error.message);
    throw error;
  }
}

// ============================================================
// EXECUTION
// ============================================================

const result = await main();

// Return minimal summary to context
return result;
