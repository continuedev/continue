/**
 * Email Drip Campaign Package
 *
 * This package provides a complete solution for running onboarding email campaigns
 * using Resend for email delivery and React Email for templates.
 */

export { DripCampaignService } from "./services/DripCampaignService";
export * from "./types";

// Email templates
export { default as WelcomeEmail } from "./templates/WelcomeEmail";
export { default as WeekOneEmail } from "./templates/WeekOneEmail";
export { default as WeekTwoEmail } from "./templates/WeekTwoEmail";
export { default as WeekThreeEmail } from "./templates/WeekThreeEmail";
