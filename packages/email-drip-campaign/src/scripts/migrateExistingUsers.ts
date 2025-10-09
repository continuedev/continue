#!/usr/bin/env node

/**
 * Migration script to enroll existing users in the drip campaign
 *
 * This script:
 * 1. Reads existing users from a CSV or JSON file
 * 2. Filters out unsubscribed users
 * 3. Enrolls them starting from email #2 (since they're already users)
 * 4. Generates a report of the migration
 *
 * Usage:
 *   npm run migrate:existing -- --file=users.csv --api-key=YOUR_RESEND_API_KEY
 *
 * CSV format:
 *   email,firstName,lastName,signUpDate,unsubscribed
 *   user@example.com,John,Doe,2024-01-01,false
 */

import * as fs from "fs";
import * as path from "path";
import { DripCampaignService } from "../services/DripCampaignService";
import { User } from "../types";

interface MigrationOptions {
  inputFile: string;
  apiKey: string;
  fromEmail?: string;
  dryRun?: boolean;
  batchSize?: number;
}

/**
 * Parse CSV file into User objects
 */
function parseCSV(filePath: string): User[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");

  // Skip header
  const headers = lines[0].toLowerCase().split(",");
  const users: User[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const user: Partial<User> = {};

    headers.forEach((header, index) => {
      const value = values[index]?.trim();
      switch (header.trim()) {
        case "email":
          user.email = value;
          break;
        case "firstname":
          user.firstName = value;
          break;
        case "lastname":
          user.lastName = value;
          break;
        case "signupdate":
          user.signUpDate = new Date(value);
          break;
        case "unsubscribed":
          user.unsubscribed = value.toLowerCase() === "true";
          break;
      }
    });

    if (user.email) {
      user.id = user.email; // Use email as ID if not provided
      users.push(user as User);
    }
  }

  return users;
}

/**
 * Parse JSON file into User objects
 */
function parseJSON(filePath: string): User[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(content);

  if (!Array.isArray(data)) {
    throw new Error("JSON file must contain an array of users");
  }

  return data.map((item) => ({
    id: item.id || item.email,
    email: item.email,
    firstName: item.firstName || item.first_name,
    lastName: item.lastName || item.last_name,
    signUpDate: new Date(item.signUpDate || item.sign_up_date || new Date()),
    unsubscribed: item.unsubscribed || false,
  }));
}

/**
 * Load users from file (CSV or JSON)
 */
function loadUsers(filePath: string): User[] {
  const ext = path.extname(filePath).toLowerCase();

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  switch (ext) {
    case ".csv":
      return parseCSV(filePath);
    case ".json":
      return parseJSON(filePath);
    default:
      throw new Error(`Unsupported file format: ${ext}. Use .csv or .json`);
  }
}

/**
 * Generate migration report
 */
function generateReport(
  totalUsers: number,
  activeUsers: number,
  unsubscribedUsers: number,
  successful: number,
  failed: number,
  outputPath: string,
) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalUsersInFile: totalUsers,
      activeUsers,
      unsubscribedUsers,
      enrolledSuccessfully: successful,
      enrollmentFailed: failed,
    },
  };

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\n📊 Migration report saved to: ${outputPath}`);
  console.log(JSON.stringify(report.summary, null, 2));
}

/**
 * Main migration function
 */
async function migrate(options: MigrationOptions) {
  console.log("🚀 Starting existing user migration...\n");

  // Load users
  console.log(`📂 Loading users from: ${options.inputFile}`);
  const allUsers = loadUsers(options.inputFile);
  console.log(`✅ Loaded ${allUsers.length} users`);

  // Filter out unsubscribed users
  const activeUsers = allUsers.filter((user) => !user.unsubscribed);
  const unsubscribedCount = allUsers.length - activeUsers.length;

  console.log(`✉️  Active users: ${activeUsers.length}`);
  console.log(`🚫 Unsubscribed users (skipped): ${unsubscribedCount}`);

  if (options.dryRun) {
    console.log("\n🔍 DRY RUN MODE - No emails will be sent");
    console.log(
      `Would enroll ${activeUsers.length} users starting from email #2`,
    );
    return;
  }

  // Initialize drip campaign service
  const service = new DripCampaignService(options.apiKey, options.fromEmail);

  // Enroll users in batches (starting from email #2)
  console.log(
    `\n📧 Enrolling users in drip campaign (starting from email #2)...`,
  );
  const { successful, failed, results } = await service.enrollUsersBatch(
    activeUsers,
    2, // Start from email #2 for existing users
    options.batchSize || 10,
  );

  console.log(`\n✅ Successfully enrolled: ${successful} users`);
  console.log(`❌ Failed to enroll: ${failed} users`);

  // Generate report
  const reportPath = path.join(
    path.dirname(options.inputFile),
    `migration-report-${Date.now()}.json`,
  );
  generateReport(
    allUsers.length,
    activeUsers.length,
    unsubscribedCount,
    successful,
    failed,
    reportPath,
  );

  // Save detailed results
  const resultsPath = path.join(
    path.dirname(options.inputFile),
    `migration-results-${Date.now()}.json`,
  );
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`📝 Detailed results saved to: ${resultsPath}`);
}

/**
 * Parse command line arguments
 */
function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: Partial<MigrationOptions> = {};

  args.forEach((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    switch (key) {
      case "file":
        options.inputFile = value;
        break;
      case "api-key":
        options.apiKey = value;
        break;
      case "from-email":
        options.fromEmail = value;
        break;
      case "dry-run":
        options.dryRun = true;
        break;
      case "batch-size":
        options.batchSize = parseInt(value, 10);
        break;
    }
  });

  // Validate required options
  if (!options.inputFile) {
    throw new Error("Missing required argument: --file");
  }

  if (!options.dryRun && !options.apiKey) {
    throw new Error("Missing required argument: --api-key (or use --dry-run)");
  }

  return options as MigrationOptions;
}

// Run migration
if (require.main === module) {
  parseArgs()
    .then(migrate)
    .then(() => {
      console.log("\n✨ Migration completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Migration failed:", error.message);
      console.error("\nUsage:");
      console.error(
        "  npm run migrate:existing -- --file=users.csv --api-key=YOUR_API_KEY",
      );
      console.error("\nOptions:");
      console.error(
        "  --file           Path to CSV or JSON file with user data",
      );
      console.error("  --api-key        Resend API key");
      console.error(
        "  --from-email     From email address (default: onboarding@continue.dev)",
      );
      console.error("  --dry-run        Run without sending emails");
      console.error(
        "  --batch-size     Number of users to process at once (default: 10)",
      );
      process.exit(1);
    });
}

export { migrate, parseArgs, loadUsers };
