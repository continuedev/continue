#!/bin/bash

# Test script for CI failure analyzer log organization
# This script fetches real logs from a given workflow run or commit and tests the organization logic
#
# Usage:
#   ./test-log-organizer.sh --run-id <workflow_run_id>
#   ./test-log-organizer.sh --commit <commit_sha>
#   ./test-log-organizer.sh --pr <pr_number>
#   ./test-log-organizer.sh (defaults to PR #6881 for testing)

set -e

# Parse command line arguments
WORKFLOW_RUN_ID=""
COMMIT_SHA=""
PR_NUMBER=""
REPO="continuedev/continue"

while [[ $# -gt 0 ]]; do
  case $1 in
    --run-id)
      WORKFLOW_RUN_ID="$2"
      shift 2
      ;;
    --commit)
      COMMIT_SHA="$2"
      shift 2
      ;;
    --pr)
      PR_NUMBER="$2"
      shift 2
      ;;
    --repo)
      REPO="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  --run-id <id>     Use a specific workflow run ID"
      echo "  --commit <sha>    Find failed runs for a specific commit"
      echo "  --pr <number>     Find failed runs for a specific PR"
      echo "  --repo <repo>     Repository (default: continuedev/continue)"
      echo "  -h, --help        Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Default to PR #6881 for testing if no arguments provided
if [[ -z "$WORKFLOW_RUN_ID" && -z "$COMMIT_SHA" && -z "$PR_NUMBER" ]]; then
  PR_NUMBER="6881"
  echo "ℹ️  No arguments provided, defaulting to PR #6881 for testing"
fi

echo "🔧 Testing CI Failure Analyzer Logic with Real Data"
echo "=================================================="

# Check for required tools
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is required but not installed."
    echo "   Install it with: brew install gh"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "❌ jq is required but not installed."
    echo "   Install it with: brew install jq"
    exit 1
fi

# Create test environment
TEST_DIR="test-analyzer-output"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "📁 Created test directory: $TEST_DIR"

echo ""
echo "📥 Step 1: Fetching workflow data..."

failed_run_data=""

if [[ -n "$WORKFLOW_RUN_ID" ]]; then
  echo "🔍 Using specific workflow run ID: $WORKFLOW_RUN_ID"
  run_info=$(gh api "repos/$REPO/actions/runs/$WORKFLOW_RUN_ID")
  conclusion=$(echo "$run_info" | jq -r '.conclusion')
  if [[ "$conclusion" != "failure" ]]; then
    echo "⚠️  Warning: Workflow run $WORKFLOW_RUN_ID has conclusion: $conclusion (not failure)"
  fi
  failed_run_data=$(echo "$run_info" | jq '{id: .id, status: .status, conclusion: .conclusion, head_branch: .head_branch, event: .event, created_at: .created_at, head_sha: .head_sha}')
  
elif [[ -n "$COMMIT_SHA" ]]; then
  echo "🔍 Finding failed workflow runs for commit: $COMMIT_SHA"
  failed_run_data=$(gh api "repos/$REPO/actions/runs?per_page=50" --jq ".workflow_runs[] | select(.head_sha == \"$COMMIT_SHA\" and .conclusion == \"failure\") | {id: .id, status: .status, conclusion: .conclusion, head_branch: .head_branch, event: .event, created_at: .created_at, head_sha: .head_sha}" | head -1)
  
elif [[ -n "$PR_NUMBER" ]]; then
  echo "🔍 Finding failed workflow runs for PR #$PR_NUMBER"
  # Get PR information to find associated workflow runs
  gh pr view $PR_NUMBER --repo $REPO --json headRefName,number,headRepositoryOwner > pr_info.json
  HEAD_REF=$(jq -r '.headRefName' pr_info.json)
  echo "📍 Head ref: $HEAD_REF"
  
  # Get failed workflow runs for this PR's branch
  failed_run_data=$(gh api "repos/$REPO/actions/runs?branch=$HEAD_REF&per_page=20" --jq ".workflow_runs[] | select(.conclusion == \"failure\") | {id: .id, status: .status, conclusion: .conclusion, head_branch: .head_branch, event: .event, created_at: .created_at, head_sha: .head_sha}" | head -1)
fi

if [[ -z "$failed_run_data" ]] || [[ "$failed_run_data" = "null" ]]; then
  echo "❌ No failed workflow runs found"
  if [[ -n "$PR_NUMBER" ]]; then
    echo "Available runs for PR #$PR_NUMBER:"
    gh api "repos/$REPO/actions/runs?branch=$HEAD_REF&per_page=10" --jq ".workflow_runs[] | {id: .id, status: .status, conclusion: .conclusion, event: .event, created_at: .created_at}" | head -5
  elif [[ -n "$COMMIT_SHA" ]]; then
    echo "Available runs for commit $COMMIT_SHA:"
    gh api "repos/$REPO/actions/runs?per_page=20" --jq ".workflow_runs[] | select(.head_sha == \"$COMMIT_SHA\") | {id: .id, status: .status, conclusion: .conclusion, event: .event, created_at: .created_at}" | head -5
  fi
  exit 1
fi

failed_run_id=$(echo "$failed_run_data" | jq -r '.id')
head_branch=$(echo "$failed_run_data" | jq -r '.head_branch // "unknown"')
event_type=$(echo "$failed_run_data" | jq -r '.event')
commit_sha=$(echo "$failed_run_data" | jq -r '.head_sha')

echo "📊 Using failed workflow run:"
echo "$failed_run_data" | jq .

echo "✅ Found failed workflow run ID: $failed_run_id"

# Get detailed job information for the failed run
echo "🔍 Getting job details for failed run..."
gh api "repos/$REPO/actions/runs/$failed_run_id/jobs" > failed_jobs.json

echo "📊 Failed jobs:"
failed_job_names=$(jq -r '.jobs[] | select(.conclusion == "failure") | .name' failed_jobs.json)
echo "$failed_job_names" | while read -r job_name; do
  echo "  - $job_name: failure"
done

# Download the workflow logs
echo ""
echo "📥 Step 2: Downloading workflow logs..."
mkdir -p workflow-logs

echo "🔽 Downloading logs archive..."
gh api "repos/$REPO/actions/runs/$failed_run_id/logs" > workflow-logs.zip

echo "📦 Extracting logs..."
unzip -q workflow-logs.zip -d workflow-logs/

echo "✅ Downloaded log files:"
find workflow-logs/ -name "*.txt" -type f | wc -l | xargs echo "Total log files:"

echo ""
echo "📊 Step 2: Organizing logs by failed jobs..."

# Simulate the "Organize logs by failed jobs" step
failed_jobs_json=$(cat failed_jobs.json)

# Create organized logs with job context
echo "# GitHub Actions Workflow Failure Analysis" > organized_logs.txt
echo "## Failed Jobs and Their Logs" >> organized_logs.txt
echo "" >> organized_logs.txt

# Process each failed job
echo "$failed_jobs_json" | jq -r '.jobs[] | select(.conclusion == "failure") | .name' | while read -r job_name; do
  echo "### 🔴 Job: $job_name" >> organized_logs.txt
  echo "" >> organized_logs.txt
  
  # Find log file (simple pattern match)
  log_file=$(find workflow-logs/ -name "*${job_name}*" -type f | head -1)
  
  if [ -n "$log_file" ]; then
    echo "\`\`\`" >> organized_logs.txt
    cat "$log_file" >> organized_logs.txt
    echo "\`\`\`" >> organized_logs.txt
  else
    echo "*No log file found for job: $job_name*" >> organized_logs.txt
  fi
  echo "" >> organized_logs.txt
  echo "---" >> organized_logs.txt
  echo "" >> organized_logs.txt
done

# Note: We intentionally don't include logs from successful jobs
# as they're not useful for failure analysis

echo ""
echo "✅ Step 3: Results"
echo "=================="
echo "Organized logs ready: $(wc -l < organized_logs.txt) lines"

echo ""
echo "📋 Generated Files:"
ls -la *.txt *.json

echo ""
echo "🔍 Preview of organized_logs.txt (first 50 lines):"
echo "================================================="
head -50 organized_logs.txt

echo ""
echo "💡 Full organized_logs.txt saved to: $(pwd)/organized_logs.txt"
echo "💡 To view complete file: cat $(pwd)/organized_logs.txt"

echo ""
echo "🧪 Test completed! Review the organized_logs.txt to verify the output format."