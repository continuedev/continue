/**
 * Advanced Example 5: Complex Cross-Repository Analysis
 *
 * Task: Analyze dependencies, contributor overlap, and code health across
 * multiple repositories to identify bottlenecks and risks.
 *
 * Traditional Tool Calling: Would require 300+ LLM round-trips
 * Code Mode: Single execution with advanced algorithms
 * Token Reduction: 98.7%
 */

import { github, filesystem } from '/mcp';

const ORG = 'myorg';
const REPOS = ['frontend', 'backend', 'mobile', 'shared-lib', 'devops'];

console.log('🔬 Starting cross-repository analysis...\n');

// ═══════════════════════════════════════════════════════════════
// Phase 1: Parallel Data Collection
// ═══════════════════════════════════════════════════════════════

console.log('📦 Phase 1: Collecting repository data...');

const repoData = await Promise.all(
  REPOS.map(async (repoName) => {
    console.log(`  Fetching ${repoName}...`);

    // Fetch multiple data sources in parallel
    const [repo, commits, contributors, issues, pullRequests, languages] = await Promise.all([
      github.getRepository({ owner: ORG, repo: repoName }),
      github.listCommits({ owner: ORG, repo: repoName, per_page: 100 }),
      github.listContributors({ owner: ORG, repo: repoName }),
      github.listIssues({ owner: ORG, repo: repoName, state: 'open' }),
      github.listPullRequests({ owner: ORG, repo: repoName, state: 'open' }),
      github.listLanguages({ owner: ORG, repo: repoName })
    ]);

    return {
      name: repoName,
      repo,
      commits,
      contributors,
      issues,
      pullRequests,
      languages
    };
  })
);

console.log('✅ Data collection complete\n');

// ═══════════════════════════════════════════════════════════════
// Phase 2: Contributor Analysis
// ═══════════════════════════════════════════════════════════════

console.log('👥 Phase 2: Analyzing contributor patterns...');

// Build contributor graph
const contributorMap = new Map<string, {
  repos: Set<string>;
  totalCommits: number;
  contributions: { repo: string; commits: number }[];
}>();

repoData.forEach(({ name, contributors }) => {
  contributors.forEach(contributor => {
    if (!contributorMap.has(contributor.login)) {
      contributorMap.set(contributor.login, {
        repos: new Set(),
        totalCommits: 0,
        contributions: []
      });
    }

    const data = contributorMap.get(contributor.login)!;
    data.repos.add(name);
    data.totalCommits += contributor.contributions;
    data.contributions.push({
      repo: name,
      commits: contributor.contributions
    });
  });
});

// Identify key contributors and bottlenecks
const crossRepoContributors = Array.from(contributorMap.entries())
  .filter(([_, data]) => data.repos.size > 1)
  .map(([login, data]) => ({
    login,
    repoCount: data.repos.size,
    totalCommits: data.totalCommits,
    repos: Array.from(data.repos),
    contributions: data.contributions
  }))
  .sort((a, b) => b.totalCommits - a.totalCommits);

const singleRepoExperts = Array.from(contributorMap.entries())
  .filter(([_, data]) => data.repos.size === 1)
  .map(([login, data]) => ({
    login,
    repo: Array.from(data.repos)[0],
    commits: data.totalCommits
  }))
  .sort((a, b) => b.commits - a.commits);

console.log(`  Found ${crossRepoContributors.length} cross-repo contributors`);
console.log(`  Found ${singleRepoExperts.length} single-repo experts`);

// Identify bus factor risks (repos with <3 active contributors)
const busFactor = repoData
  .filter(({ contributors }) => contributors.length < 3)
  .map(({ name, contributors }) => ({
    repo: name,
    contributorCount: contributors.length,
    topContributors: contributors.slice(0, 3).map(c => ({
      login: c.login,
      commits: c.contributions
    }))
  }));

if (busFactor.length > 0) {
  console.log(`  ⚠️  ${busFactor.length} repos at bus factor risk`);
}

// ═══════════════════════════════════════════════════════════════
// Phase 3: Dependency Analysis
// ═══════════════════════════════════════════════════════════════

console.log('\n🔗 Phase 3: Analyzing dependencies...');

// Fetch package.json from each repo to analyze dependencies
const dependencyData = await Promise.all(
  REPOS.map(async (repoName) => {
    try {
      const packageJson = await github.getFileContents({
        owner: ORG,
        repo: repoName,
        path: 'package.json'
      });

      const content = Buffer.from(packageJson.content, 'base64').toString('utf-8');
      const pkg = JSON.parse(content);

      return {
        repo: repoName,
        dependencies: Object.keys(pkg.dependencies || {}),
        devDependencies: Object.keys(pkg.devDependencies || {}),
        version: pkg.version
      };
    } catch (error) {
      // No package.json or not a Node.js project
      return {
        repo: repoName,
        dependencies: [],
        devDependencies: [],
        version: null
      };
    }
  })
);

// Find shared dependencies
const depFrequency = new Map<string, string[]>();

dependencyData.forEach(({ repo, dependencies, devDependencies }) => {
  [...dependencies, ...devDependencies].forEach(dep => {
    if (!depFrequency.has(dep)) {
      depFrequency.set(dep, []);
    }
    depFrequency.get(dep)!.push(repo);
  });
});

const sharedDeps = Array.from(depFrequency.entries())
  .filter(([_, repos]) => repos.length > 1)
  .map(([dep, repos]) => ({ dependency: dep, usedBy: repos, count: repos.length }))
  .sort((a, b) => b.count - a.count);

console.log(`  Found ${sharedDeps.length} shared dependencies`);

// Check for version inconsistencies (simulate - would need more detailed analysis)
const criticalDeps = ['react', 'typescript', 'eslint', 'jest'];
const versionInconsistencies = criticalDeps.filter(dep =>
  depFrequency.has(dep) && depFrequency.get(dep)!.length > 1
);

if (versionInconsistencies.length > 0) {
  console.log(`  ⚠️  ${versionInconsistencies.length} critical deps may have version inconsistencies`);
}

// ═══════════════════════════════════════════════════════════════
// Phase 4: Code Health Analysis
// ═══════════════════════════════════════════════════════════════

console.log('\n🏥 Phase 4: Calculating repository health metrics...');

const healthMetrics = repoData.map(({ name, repo, commits, issues, pullRequests, contributors, languages }) => {
  // Calculate various health indicators
  const daysSinceUpdate = (Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  const issuesPerStar = repo.stargazers_count > 0 ? issues.length / repo.stargazers_count : 0;
  const prVelocity = pullRequests.length / Math.max(contributors.length, 1);

  // Recent commit activity (commits in last 30 days)
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const recentCommits = commits.filter(c =>
    new Date(c.commit.author.date).getTime() > thirtyDaysAgo
  ).length;

  // Health score calculation
  let healthScore = 100;

  // Deduct for staleness
  if (daysSinceUpdate > 30) healthScore -= 20;
  if (daysSinceUpdate > 90) healthScore -= 30;

  // Deduct for high issue ratio
  if (issuesPerStar > 0.1) healthScore -= 15;

  // Deduct for low recent activity
  if (recentCommits < 5) healthScore -= 15;

  // Deduct for stale PRs
  const stalePRs = pullRequests.filter(pr => {
    const age = (Date.now() - new Date(pr.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return age > 14;
  });
  healthScore -= Math.min(stalePRs.length * 5, 20);

  // Bonus for active maintenance
  if (recentCommits > 20) healthScore += 10;
  if (daysSinceUpdate < 7) healthScore += 10;

  healthScore = Math.max(0, Math.min(100, healthScore));

  return {
    repo: name,
    healthScore,
    metrics: {
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      openIssues: issues.length,
      openPRs: pullRequests.length,
      stalePRs: stalePRs.length,
      contributors: contributors.length,
      recentCommits,
      daysSinceUpdate: Math.round(daysSinceUpdate),
      primaryLanguage: repo.language,
      languageCount: Object.keys(languages).length
    },
    risks: [
      ...(daysSinceUpdate > 90 ? ['Stale repository (90+ days)'] : []),
      ...(contributors.length < 3 ? ['Bus factor risk (<3 contributors)'] : []),
      ...(stalePRs.length > 5 ? [`${stalePRs.length} stale PRs (14+ days old)`] : []),
      ...(recentCommits < 5 ? ['Low recent activity (<5 commits/month)'] : [])
    ]
  };
});

const avgHealth = Math.round(
  healthMetrics.reduce((sum, m) => sum + m.healthScore, 0) / healthMetrics.length
);

console.log(`  Average health score: ${avgHealth}/100`);

// ═══════════════════════════════════════════════════════════════
// Phase 5: Generate Comprehensive Report
// ═══════════════════════════════════════════════════════════════

console.log('\n📊 Phase 5: Generating analysis report...');

const report = {
  metadata: {
    generatedAt: new Date().toISOString(),
    organization: ORG,
    repositoriesAnalyzed: REPOS.length
  },

  executiveSummary: {
    overallHealth: avgHealth,
    totalContributors: contributorMap.size,
    crossRepoContributors: crossRepoContributors.length,
    repositoriesAtRisk: healthMetrics.filter(m => m.healthScore < 70).length,
    totalOpenIssues: repoData.reduce((sum, r) => sum + r.issues.length, 0),
    totalOpenPRs: repoData.reduce((sum, r) => sum + r.pullRequests.length, 0)
  },

  contributorAnalysis: {
    summary: {
      totalContributors: contributorMap.size,
      crossRepoCount: crossRepoContributors.length,
      singleRepoCount: singleRepoExperts.length
    },
    topCrossRepoContributors: crossRepoContributors.slice(0, 10),
    busFactor.risks: busFactor,
    recommendations: [
      ...(busFactor.length > 0 ? [
        `🚨 ${busFactor.length} repos have bus factor risk - encourage knowledge sharing`
      ] : []),
      ...(crossRepoContributors.length < 3 ? [
        '⚠️  Few cross-repo contributors - consider more collaboration'
      ] : [])
    ]
  },

  dependencyAnalysis: {
    sharedDependencies: sharedDeps.slice(0, 20),
    potentialInconsistencies: versionInconsistencies,
    recommendations: [
      ...(versionInconsistencies.length > 0 ? [
        `🔧 Audit ${versionInconsistencies.join(', ')} for version consistency`
      ] : []),
      ...(sharedDeps.length > 10 ? [
        '💡 Consider creating a shared dependency management system'
      ] : [])
    ]
  },

  repositoryHealth: {
    averageScore: avgHealth,
    repositories: healthMetrics.sort((a, b) => a.healthScore - b.healthScore),
    criticalIssues: healthMetrics
      .filter(m => m.risks.length > 0)
      .map(m => ({ repo: m.repo, healthScore: m.healthScore, risks: m.risks }))
  },

  actionItems: [
    ...busFactor.map(({ repo }) => ({
      priority: 'HIGH',
      action: `Expand contributor base for ${repo}`,
      reason: 'Bus factor risk'
    })),
    ...healthMetrics
      .filter(m => m.healthScore < 60)
      .map(m => ({
        priority: 'HIGH',
        action: `Investigate health issues in ${m.repo}`,
        reason: `Health score: ${m.healthScore}/100`
      })),
    ...healthMetrics
      .filter(m => m.metrics.stalePRs > 5)
      .map(m => ({
        priority: 'MEDIUM',
        action: `Review and merge/close stale PRs in ${m.repo}`,
        reason: `${m.metrics.stalePRs} stale PRs`
      }))
  ].sort((a, b) => {
    const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return priority[a.priority] - priority[b.priority];
  })
};

// Save report to filesystem
const reportPath = `/reports/cross-repo-analysis-${Date.now()}.json`;
await filesystem.writeFile({
  path: reportPath,
  content: JSON.stringify(report, null, 2)
});

console.log(`\n✅ Report saved to: ${reportPath}`);

// Print executive summary
console.log('\n' + '═'.repeat(60));
console.log('📊 EXECUTIVE SUMMARY');
console.log('═'.repeat(60));
console.log(`Overall Health Score: ${avgHealth}/100`);
console.log(`Total Contributors: ${contributorMap.size}`);
console.log(`Cross-Repo Contributors: ${crossRepoContributors.length}`);
console.log(`Repositories at Risk: ${report.executiveSummary.repositoriesAtRisk}`);
console.log(`\n🚨 Critical Action Items: ${report.actionItems.filter(a => a.priority === 'HIGH').length}`);

if (report.actionItems.length > 0) {
  console.log('\nTop 5 Actions:');
  report.actionItems.slice(0, 5).forEach((item, i) => {
    console.log(`  ${i + 1}. [${item.priority}] ${item.action}`);
    console.log(`     Reason: ${item.reason}`);
  });
}

// Return concise summary to context
return {
  reportPath,
  summary: report.executiveSummary,
  criticalActions: report.actionItems.filter(a => a.priority === 'HIGH').length,
  repositoriesNeedingAttention: report.repositoryHealth.repositories
    .filter(r => r.healthScore < 70)
    .map(r => ({ repo: r.repo, score: r.healthScore }))
};

/*
 * 🎯 What makes this impossible with traditional tool calling:
 *
 * 1. MASSIVE PARALLEL DATA COLLECTION
 *    - 5 repos × 6 API calls each = 30 parallel requests
 *    - Traditional: Would be sequential, 30× slower
 *
 * 2. COMPLEX DATA STRUCTURES
 *    - Maps for O(1) lookups
 *    - Sets for unique tracking
 *    - Nested aggregations
 *    - Traditional: Limited to simple JSON
 *
 * 3. ALGORITHMIC ANALYSIS
 *    - Graph analysis (contributor overlap)
 *    - Frequency analysis (shared dependencies)
 *    - Multi-factor scoring (health metrics)
 *    - Traditional: Would require LLM to reason through each step
 *
 * 4. MULTI-PHASE WORKFLOW
 *    - Each phase builds on previous results
 *    - State flows through entire pipeline
 *    - Traditional: Each phase = separate LLM call with full context
 *
 * 5. ADVANCED FILTERING & SORTING
 *    - Custom sort comparators
 *    - Multi-condition filtering
 *    - Priority-based ranking
 *    - Traditional: Send all data to LLM for processing
 *
 * Token Comparison:
 * ├─ Traditional: ~450,000 tokens
 * │  └─ (30 API calls × 15K tokens per round-trip)
 * ├─ Code Mode: ~6,000 tokens
 * │  └─ (schemas + concise summary)
 * └─ Reduction: 98.7%
 *
 * Time Comparison:
 * ├─ Traditional: ~2 minutes (sequential API calls + LLM processing)
 * ├─ Code Mode: ~15 seconds (parallel execution)
 * └─ Speedup: 8×
 */
