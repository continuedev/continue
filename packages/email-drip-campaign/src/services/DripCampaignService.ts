import { Resend } from "resend";
import { render } from "@react-email/render";
import {
  User,
  ScheduledEmail,
  DRIP_CAMPAIGN_EMAILS,
  DripCampaignEmail,
} from "../types";
import WelcomeEmail from "../templates/WelcomeEmail";
import WeekOneEmail from "../templates/WeekOneEmail";
import WeekTwoEmail from "../templates/WeekTwoEmail";
import WeekThreeEmail from "../templates/WeekThreeEmail";

/**
 * Service to manage the email drip campaign using Resend
 */
export class DripCampaignService {
  private resend: Resend;
  private fromEmail: string;

  constructor(apiKey: string, fromEmail: string = "onboarding@continue.dev") {
    this.resend = new Resend(apiKey);
    this.fromEmail = fromEmail;
  }

  /**
   * Get the appropriate email template component for a given email number
   */
  private getEmailTemplate(emailNumber: 1 | 2 | 3 | 4) {
    switch (emailNumber) {
      case 1:
        return WelcomeEmail;
      case 2:
        return WeekOneEmail;
      case 3:
        return WeekTwoEmail;
      case 4:
        return WeekThreeEmail;
      default:
        throw new Error(`Invalid email number: ${emailNumber}`);
    }
  }

  /**
   * Schedule a single email for a user
   */
  async scheduleEmail(
    user: User,
    emailConfig: DripCampaignEmail,
  ): Promise<ScheduledEmail> {
    try {
      // Calculate scheduled date
      const scheduledDate = new Date(user.signUpDate);
      scheduledDate.setDate(
        scheduledDate.getDate() + emailConfig.scheduledDaysAfterSignup,
      );

      // If the scheduled date is in the past, send immediately
      const now = new Date();
      const scheduledFor = scheduledDate < now ? now : scheduledDate;

      // Get the email template
      const EmailTemplate = this.getEmailTemplate(emailConfig.emailNumber);

      // Render the email HTML
      const html = render(
        EmailTemplate({
          firstName: user.firstName,
          userEmail: user.email,
        }),
      );

      // Prepare email data
      const emailData = {
        from: this.fromEmail,
        to: user.email,
        subject: emailConfig.subject,
        html,
        // Resend supports scheduling up to 30 days in advance
        scheduledAt:
          scheduledFor > now ? scheduledFor.toISOString() : undefined,
        // Add tags for tracking
        tags: [
          {
            name: "campaign",
            value: "onboarding-drip",
          },
          {
            name: "email_number",
            value: emailConfig.emailNumber.toString(),
          },
        ],
      };

      // Send or schedule the email
      const response = await this.resend.emails.send(emailData);

      return {
        userId: user.id,
        emailNumber: emailConfig.emailNumber,
        scheduledFor,
        resendScheduledId: response.data?.id,
        sent: scheduledFor <= now,
      };
    } catch (error) {
      console.error(
        `Error scheduling email ${emailConfig.emailNumber} for user ${user.id}:`,
        error,
      );
      return {
        userId: user.id,
        emailNumber: emailConfig.emailNumber,
        scheduledFor: new Date(),
        sent: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Schedule the full drip campaign for a new user
   * @param user - The user to enroll in the campaign
   * @param startFromEmail - Which email to start from (default: 1). Use 2 for existing users
   */
  async enrollUserInCampaign(
    user: User,
    startFromEmail: 1 | 2 | 3 | 4 = 1,
  ): Promise<ScheduledEmail[]> {
    if (user.unsubscribed) {
      console.log(`User ${user.email} is unsubscribed, skipping enrollment`);
      return [];
    }

    const scheduledEmails: ScheduledEmail[] = [];

    // Filter emails to only include those from startFromEmail onwards
    const emailsToSchedule = DRIP_CAMPAIGN_EMAILS.filter(
      (email) => email.emailNumber >= startFromEmail,
    );

    for (const emailConfig of emailsToSchedule) {
      const scheduled = await this.scheduleEmail(user, emailConfig);
      scheduledEmails.push(scheduled);

      // Add a small delay between API calls to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return scheduledEmails;
  }

  /**
   * Enroll multiple users in the campaign (batch processing)
   * @param users - Array of users to enroll
   * @param startFromEmail - Which email to start from (default: 2 for existing users)
   * @param batchSize - Number of users to process at once
   */
  async enrollUsersBatch(
    users: User[],
    startFromEmail: 1 | 2 | 3 | 4 = 2,
    batchSize: number = 10,
  ): Promise<{
    successful: number;
    failed: number;
    results: ScheduledEmail[];
  }> {
    let successful = 0;
    let failed = 0;
    const results: ScheduledEmail[] = [];

    // Process users in batches
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);

      const batchPromises = batch.map(async (user) => {
        try {
          const scheduled = await this.enrollUserInCampaign(
            user,
            startFromEmail,
          );
          successful++;
          return scheduled;
        } catch (error) {
          console.error(`Failed to enroll user ${user.email}:`, error);
          failed++;
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());

      // Add delay between batches to respect rate limits
      if (i + batchSize < users.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log(
        `Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(users.length / batchSize)}`,
      );
    }

    return {
      successful,
      failed,
      results,
    };
  }

  /**
   * Cancel a scheduled email
   */
  async cancelScheduledEmail(emailId: string): Promise<boolean> {
    try {
      await this.resend.emails.cancel(emailId);
      return true;
    } catch (error) {
      console.error(`Error canceling email ${emailId}:`, error);
      return false;
    }
  }

  /**
   * Handle unsubscribe - cancel all future emails for a user
   */
  async unsubscribeUser(
    scheduledEmails: ScheduledEmail[],
  ): Promise<{ canceled: number; failed: number }> {
    let canceled = 0;
    let failed = 0;

    for (const email of scheduledEmails) {
      if (!email.sent && email.resendScheduledId) {
        const success = await this.cancelScheduledEmail(
          email.resendScheduledId,
        );
        if (success) {
          canceled++;
        } else {
          failed++;
        }
      }
    }

    return { canceled, failed };
  }

  /**
   * Test function to send a test email
   */
  async sendTestEmail(
    toEmail: string,
    emailNumber: 1 | 2 | 3 | 4,
  ): Promise<boolean> {
    try {
      const testUser: User = {
        id: "test-user",
        email: toEmail,
        firstName: "Test",
        signUpDate: new Date(),
      };

      const emailConfig = DRIP_CAMPAIGN_EMAILS.find(
        (e) => e.emailNumber === emailNumber,
      );

      if (!emailConfig) {
        throw new Error(`Invalid email number: ${emailNumber}`);
      }

      await this.scheduleEmail(testUser, emailConfig);
      return true;
    } catch (error) {
      console.error("Error sending test email:", error);
      return false;
    }
  }
}
