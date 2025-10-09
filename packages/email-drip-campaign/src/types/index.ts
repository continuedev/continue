/**
 * Types for the email drip campaign system
 */

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  signUpDate: Date;
  unsubscribed?: boolean;
}

export interface DripCampaignEmail {
  emailNumber: 1 | 2 | 3 | 4;
  subject: string;
  scheduledDaysAfterSignup: number;
}

export const DRIP_CAMPAIGN_EMAILS: DripCampaignEmail[] = [
  {
    emailNumber: 1,
    subject: "Welcome to Continue - Let's Get Started!",
    scheduledDaysAfterSignup: 0, // Immediate
  },
  {
    emailNumber: 2,
    subject: "Your First Week with Continue: Key Features",
    scheduledDaysAfterSignup: 7,
  },
  {
    emailNumber: 3,
    subject: "Supercharge Your Workflow with Continue",
    scheduledDaysAfterSignup: 14,
  },
  {
    emailNumber: 4,
    subject: "Continue Pro Tips: Getting the Most Out of Your Setup",
    scheduledDaysAfterSignup: 21,
  },
];

export interface ScheduledEmail {
  userId: string;
  emailNumber: 1 | 2 | 3 | 4;
  scheduledFor: Date;
  resendScheduledId?: string;
  sent: boolean;
  error?: string;
}

export interface EmailTemplateProps {
  firstName?: string;
  userEmail: string;
}
