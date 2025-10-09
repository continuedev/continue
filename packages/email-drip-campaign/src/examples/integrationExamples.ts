/**
 * Integration Examples
 *
 * This file demonstrates how to integrate the drip campaign system
 * into various parts of your application.
 */

import { DripCampaignService } from "../services/DripCampaignService";
import { User } from "../types";

// Initialize the service (typically done once in your app)
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@continue.dev";

const dripCampaign = new DripCampaignService(RESEND_API_KEY, FROM_EMAIL);

/**
 * Example 1: Sign-up webhook handler
 *
 * Call this when a user signs up through your application
 */
export async function handleUserSignup(userData: {
  email: string;
  firstName?: string;
  lastName?: string;
}) {
  const user: User = {
    id: userData.email, // or generate a UUID
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    signUpDate: new Date(),
    unsubscribed: false,
  };

  try {
    // Enroll user starting from email #1 (welcome email)
    const scheduledEmails = await dripCampaign.enrollUserInCampaign(user, 1);

    console.log(
      `Enrolled ${user.email} in drip campaign. Scheduled ${scheduledEmails.length} emails.`,
    );

    return { success: true, scheduledEmails };
  } catch (error) {
    console.error("Failed to enroll user in drip campaign:", error);
    return { success: false, error };
  }
}

/**
 * Example 2: Daily batch processing
 *
 * Run this as a cron job to process all new signups from the previous day
 */
export async function processDailySignups(newUsers: User[]) {
  console.log(`Processing ${newUsers.length} new signups from yesterday...`);

  const result = await dripCampaign.enrollUsersBatch(
    newUsers,
    1, // Start from welcome email
    10, // Batch size
  );

  console.log(`Successfully enrolled: ${result.successful}`);
  console.log(`Failed: ${result.failed}`);

  return result;
}

/**
 * Example 3: WorkOS webhook integration
 *
 * Handle user authentication events from WorkOS
 */
export async function handleWorkOSWebhook(event: any) {
  // Example WorkOS webhook payload structure
  if (event.event === "user.created") {
    const userData = {
      email: event.data.email,
      firstName: event.data.first_name,
      lastName: event.data.last_name,
    };

    return handleUserSignup(userData);
  }
}

/**
 * Example 4: Loops.so integration
 *
 * Fetch users from Loops.so and enroll them in the campaign
 */
export async function syncFromLoops(loopsApiKey: string) {
  // This is a placeholder - you would use Loops.so API client
  const loopsUsers = await fetchUsersFromLoops(loopsApiKey);

  // Convert to our User format
  const users: User[] = loopsUsers.map((loopsUser: any) => ({
    id: loopsUser.id,
    email: loopsUser.email,
    firstName: loopsUser.firstName,
    lastName: loopsUser.lastName,
    signUpDate: new Date(loopsUser.createdAt),
    unsubscribed: loopsUser.unsubscribed,
  }));

  // Enroll existing users starting from email #2
  return dripCampaign.enrollUsersBatch(users, 2);
}

/**
 * Example 5: Handle unsubscribe
 *
 * When a user clicks unsubscribe link
 */
export async function handleUnsubscribe(
  userId: string,
  scheduledEmailIds: string[],
) {
  console.log(`Processing unsubscribe for user: ${userId}`);

  // Cancel all scheduled emails
  const scheduledEmails = scheduledEmailIds.map((id) => ({
    userId,
    emailNumber: 1 as const,
    scheduledFor: new Date(),
    resendScheduledId: id,
    sent: false,
  }));

  const result = await dripCampaign.unsubscribeUser(scheduledEmails);

  console.log(`Canceled ${result.canceled} scheduled emails`);
  console.log(`Failed to cancel ${result.failed} emails`);

  // Update your database to mark user as unsubscribed
  // await db.users.update({ id: userId, unsubscribed: true });

  return result;
}

/**
 * Example 6: Send test email
 *
 * Useful for testing templates in development
 */
export async function sendTestEmail() {
  const testEmail = "test@continue.dev";

  console.log(`Sending test email to ${testEmail}...`);

  // Test each email in the sequence
  for (let i = 1; i <= 4; i++) {
    const success = await dripCampaign.sendTestEmail(
      testEmail,
      i as 1 | 2 | 3 | 4,
    );

    if (success) {
      console.log(`✅ Test email #${i} sent successfully`);
    } else {
      console.log(`❌ Failed to send test email #${i}`);
    }

    // Wait between sends
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

/**
 * Placeholder function for Loops.so integration
 */
async function fetchUsersFromLoops(apiKey: string): Promise<any[]> {
  // Implement Loops.so API call here
  // Example:
  // const response = await fetch('https://loops.so/api/v1/contacts', {
  //   headers: { 'Authorization': `Bearer ${apiKey}` }
  // });
  // return response.json();

  return [];
}

/**
 * Example 7: Express.js webhook endpoint
 */
export function createWebhookHandler() {
  return async (req: any, res: any) => {
    try {
      const { email, firstName, lastName } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const result = await handleUserSignup({ email, firstName, lastName });

      if (result.success) {
        return res.status(200).json({
          message: "User enrolled in drip campaign",
          scheduledEmails: result.scheduledEmails,
        });
      } else {
        return res.status(500).json({
          error: "Failed to enroll user",
          details: result.error,
        });
      }
    } catch (error) {
      console.error("Webhook error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}
