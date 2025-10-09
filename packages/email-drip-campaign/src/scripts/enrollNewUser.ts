#!/usr/bin/env node

/**
 * Script to enroll a new user in the drip campaign
 *
 * This can be:
 * 1. Called directly when a user signs up
 * 2. Run as a cron job to process new signups in batches
 * 3. Integrated into your signup webhook/API
 *
 * Usage:
 *   npm run enroll:new -- --email=user@example.com --first-name=John --api-key=YOUR_API_KEY
 */

import { DripCampaignService } from "../services/DripCampaignService";
import { User } from "../types";

interface EnrollOptions {
  email: string;
  firstName?: string;
  lastName?: string;
  apiKey: string;
  fromEmail?: string;
}

/**
 * Enroll a single new user
 */
async function enrollNewUser(options: EnrollOptions) {
  console.log(`📧 Enrolling new user: ${options.email}`);

  const user: User = {
    id: options.email,
    email: options.email,
    firstName: options.firstName,
    lastName: options.lastName,
    signUpDate: new Date(),
    unsubscribed: false,
  };

  const service = new DripCampaignService(options.apiKey, options.fromEmail);

  try {
    // Enroll starting from email #1 (welcome email)
    const scheduledEmails = await service.enrollUserInCampaign(user, 1);

    console.log(`✅ Successfully enrolled ${options.email}`);
    console.log(`📅 Scheduled ${scheduledEmails.length} emails:`);

    scheduledEmails.forEach((email) => {
      console.log(
        `  - Email #${email.emailNumber}: ${email.scheduledFor.toLocaleDateString()}`,
      );
    });

    return { success: true, scheduledEmails };
  } catch (error) {
    console.error(`❌ Failed to enroll ${options.email}:`, error);
    return { success: false, error };
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): EnrollOptions {
  const args = process.argv.slice(2);
  const options: Partial<EnrollOptions> = {};

  args.forEach((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    switch (key) {
      case "email":
        options.email = value;
        break;
      case "first-name":
        options.firstName = value;
        break;
      case "last-name":
        options.lastName = value;
        break;
      case "api-key":
        options.apiKey = value;
        break;
      case "from-email":
        options.fromEmail = value;
        break;
    }
  });

  // Validate required options
  if (!options.email) {
    throw new Error("Missing required argument: --email");
  }

  if (!options.apiKey) {
    throw new Error("Missing required argument: --api-key");
  }

  return options as EnrollOptions;
}

// Run enrollment
if (require.main === module) {
  parseArgs()
    .then(enrollNewUser)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Enrollment failed:", error.message);
      console.error("\nUsage:");
      console.error(
        "  npm run enroll:new -- --email=user@example.com --api-key=YOUR_API_KEY",
      );
      console.error("\nOptions:");
      console.error("  --email          User's email address (required)");
      console.error("  --first-name     User's first name");
      console.error("  --last-name      User's last name");
      console.error("  --api-key        Resend API key (required)");
      console.error(
        "  --from-email     From email address (default: onboarding@continue.dev)",
      );
      process.exit(1);
    });
}

export { enrollNewUser, parseArgs };
