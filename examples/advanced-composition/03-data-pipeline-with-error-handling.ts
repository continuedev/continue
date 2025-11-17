/**
 * Advanced Example 3: Robust Data Pipeline with Error Handling
 *
 * Task: Process user-uploaded files, validate, transform, and sync to GitHub
 * with comprehensive error handling and retry logic.
 *
 * Traditional Tool Calling: Complex error handling nearly impossible
 * Code Mode: Full try-catch, retries, fallbacks
 * Token Reduction: 96.8%
 */

import { filesystem, github } from '/mcp';

// Configuration
const INPUT_DIR = '/uploads/data';
const OUTPUT_DIR = '/processed/data';
const GITHUB_OWNER = 'myorg';
const GITHUB_REPO = 'data-repo';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

// Utility: Sleep function
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Utility: Retry wrapper with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;

    console.log(`⚠️  Operation failed, retrying in ${delay}ms... (${retries} retries left)`);
    await sleep(delay);
    return withRetry(fn, retries - 1, delay * 2); // Exponential backoff
  }
}

// Processing results tracker
interface ProcessingResult {
  filename: string;
  status: 'success' | 'error' | 'skipped';
  reason?: string;
  outputPath?: string;
  githubUrl?: string;
}

const results: ProcessingResult[] = [];

console.log('🚀 Starting data processing pipeline...\n');

// Step 1: List all files in input directory
console.log('📂 Scanning input directory...');
let files: string[];
try {
  const dirContents = await filesystem.listDirectory({ path: INPUT_DIR });
  files = dirContents
    .filter(item => item.type === 'file' && item.name.endsWith('.json'))
    .map(item => item.name);

  console.log(`✅ Found ${files.length} JSON files to process\n`);
} catch (error) {
  console.error('❌ Failed to read input directory:', error.message);
  throw new Error('Pipeline failed: Cannot access input directory');
}

// Step 2: Process each file with error handling
for (const filename of files) {
  console.log(`📄 Processing: ${filename}`);
  const inputPath = `${INPUT_DIR}/${filename}`;
  const outputPath = `${OUTPUT_DIR}/${filename}`;

  try {
    // 2a. Read file with retry logic
    const rawContent = await withRetry(async () => {
      return await filesystem.readFile({ path: inputPath });
    });

    // 2b. Validate JSON
    let data;
    try {
      data = JSON.parse(rawContent);
    } catch (parseError) {
      console.log(`  ⚠️  Invalid JSON, skipping`);
      results.push({
        filename,
        status: 'skipped',
        reason: 'Invalid JSON format'
      });
      continue;
    }

    // 2c. Validate schema (example: require 'id' and 'data' fields)
    if (!data.id || !data.data) {
      console.log(`  ⚠️  Missing required fields, skipping`);
      results.push({
        filename,
        status: 'skipped',
        reason: 'Missing required fields (id, data)'
      });
      continue;
    }

    // 2d. Transform data
    const processed = {
      ...data,
      processedAt: new Date().toISOString(),
      processedBy: 'code-mode-pipeline',
      metadata: {
        originalFilename: filename,
        validator: 'v1.0',
        checksumValid: true // In reality, you'd calculate this
      }
    };

    // 2e. Write to output directory with retry
    await withRetry(async () => {
      await filesystem.writeFile({
        path: outputPath,
        content: JSON.stringify(processed, null, 2)
      });
    });

    console.log(`  💾 Saved to: ${outputPath}`);

    // 2f. Sync to GitHub (with error handling)
    let githubUrl: string | undefined;
    try {
      const githubPath = `data/${filename}`;

      // Check if file exists in GitHub
      let sha: string | undefined;
      try {
        const existing = await github.getFileContents({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          path: githubPath
        });
        sha = existing.sha; // Need SHA to update existing file
        console.log(`  🔄 Updating existing file in GitHub...`);
      } catch {
        console.log(`  📤 Creating new file in GitHub...`);
      }

      // Create or update file with retry
      const result = await withRetry(async () => {
        return await github.createOrUpdateFile({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          path: githubPath,
          message: `Update ${filename} via automated pipeline`,
          content: Buffer.from(JSON.stringify(processed, null, 2)).toString('base64'),
          sha // Include if updating existing file
        });
      });

      githubUrl = result.content.html_url;
      console.log(`  ✅ Synced to GitHub: ${githubUrl}`);
    } catch (githubError) {
      console.log(`  ⚠️  GitHub sync failed: ${githubError.message}`);
      // Continue anyway - local processing succeeded
    }

    results.push({
      filename,
      status: 'success',
      outputPath,
      githubUrl
    });

    console.log(`  ✅ Complete\n`);

  } catch (error) {
    console.log(`  ❌ Error: ${error.message}\n`);
    results.push({
      filename,
      status: 'error',
      reason: error.message
    });
  }
}

// Step 3: Generate summary report
console.log('\n📊 Pipeline Summary:');
console.log('═'.repeat(50));

const summary = {
  totalFiles: files.length,
  successful: results.filter(r => r.status === 'success').length,
  errors: results.filter(r => r.status === 'error').length,
  skipped: results.filter(r => r.status === 'skipped').length,
  syncedToGithub: results.filter(r => r.githubUrl).length
};

console.log(`Total files: ${summary.totalFiles}`);
console.log(`✅ Successful: ${summary.successful}`);
console.log(`❌ Errors: ${summary.errors}`);
console.log(`⚠️  Skipped: ${summary.skipped}`);
console.log(`📤 Synced to GitHub: ${summary.syncedToGithub}`);

// Step 4: Save detailed results log
const logPath = `${OUTPUT_DIR}/pipeline-log-${Date.now()}.json`;
await filesystem.writeFile({
  path: logPath,
  content: JSON.stringify({
    timestamp: new Date().toISOString(),
    summary,
    results
  }, null, 2)
});

console.log(`\n💾 Detailed log saved to: ${logPath}`);

// Step 5: Create GitHub issue if there were errors
if (summary.errors > 0) {
  console.log(`\n📝 Creating GitHub issue for errors...`);

  const errorFiles = results
    .filter(r => r.status === 'error')
    .map(r => `- \`${r.filename}\`: ${r.reason}`)
    .join('\n');

  const issue = await github.createIssue({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    title: `🚨 Data Pipeline Errors: ${summary.errors} files failed`,
    body: `
## Pipeline Execution Report

**Timestamp:** ${new Date().toISOString()}
**Status:** ⚠️ Completed with errors

### Summary
- Total files processed: ${summary.totalFiles}
- Successful: ${summary.successful}
- **Errors: ${summary.errors}**
- Skipped: ${summary.skipped}

### Failed Files
${errorFiles}

### Next Steps
1. Review the detailed log: \`${logPath}\`
2. Fix validation issues in source files
3. Re-run pipeline for failed files

### Logs
Full processing log available at: \`${logPath}\`
    `.trim(),
    labels: ['automated', 'data-pipeline', 'error']
  });

  console.log(`✅ Created issue: ${issue.html_url}`);
}

console.log('\n🎉 Pipeline execution complete!');

// Return summary to context
return {
  pipelineStatus: summary.errors === 0 ? 'success' : 'completed-with-errors',
  ...summary,
  logPath
};

/*
 * 🎯 What makes this impossible with traditional tool calling:
 *
 * 1. SOPHISTICATED ERROR HANDLING
 *    - Try-catch blocks
 *    - Retry logic with exponential backoff
 *    - Graceful degradation (continue on GitHub sync failure)
 *    - Traditional: Would require complex LLM reasoning for each error
 *
 * 2. CONTROL FLOW
 *    - For loops with continue/break
 *    - Conditional execution based on validation
 *    - Traditional: Each iteration = LLM round-trip
 *
 * 3. STATE TRACKING
 *    - Accumulate results across iterations
 *    - Generate summary from accumulated state
 *    - Traditional: Context grows massively with each iteration
 *
 * 4. HELPER FUNCTIONS
 *    - Reusable retry logic
 *    - Sleep/delay utilities
 *    - Traditional: No way to define reusable patterns
 *
 * 5. COMPLEX DECISION TREES
 *    - Check if file exists → update vs create
 *    - Validate → skip vs process
 *    - Error count → create issue vs don't
 *    - Traditional: Each decision = LLM call
 *
 * Token Comparison:
 * ├─ Traditional: ~220,000 tokens
 * │  └─ (20 files × ~11,000 tokens per file with error handling)
 * ├─ Code Mode: ~7,000 tokens
 * │  └─ (schemas + summary result)
 * └─ Reduction: 96.8%
 */
