# Email Drip Campaign

A complete onboarding email drip campaign system for Continue, built with [Resend](https://resend.com) for email delivery and [React Email](https://react.email) for beautiful, responsive templates.

## Overview

This package automates the welcome and onboarding sequence for new Continue users:

- **Email 1 (Day 0)**: Welcome email - sent immediately upon signup
- **Email 2 (Day 7)**: Your First Week with Continue - key features
- **Email 3 (Day 14)**: Supercharge Your Workflow - advanced features
- **Email 4 (Day 21)**: Continue Pro Tips - best practices and community

All emails are scheduled automatically using Resend's scheduling API (up to 30 days in advance), support personalization with user data, and include unsubscribe handling.

## Features

- ✨ Beautiful, responsive email templates built with React Email
- 📅 Automatic scheduling via Resend (up to 30 days in advance)
- 👤 Personalization with user first name and other data
- 🔄 Batch processing for existing users
- 🚫 Unsubscribe handling
- 📊 Progress tracking and reporting
- 🧪 Test mode for development
- 📦 TypeScript support

## Setup

### 1. Install Dependencies

```bash
cd packages/email-drip-campaign
npm install
```

### 2. Configure Environment

Create a `.env` file or set environment variables:

```bash
RESEND_API_KEY=re_your_api_key_here
FROM_EMAIL=onboarding@continue.dev
```

You can get a Resend API key from [resend.com/api-keys](https://resend.com/api-keys).

### 3. Build the Package

```bash
npm run build
```

## Usage

### For New Signups

#### Option 1: Programmatic Enrollment

```typescript
import { DripCampaignService } from "@continuedev/email-drip-campaign";

const dripCampaign = new DripCampaignService(
  process.env.RESEND_API_KEY,
  "onboarding@continue.dev",
);

// When a user signs up
const user = {
  id: "user-123",
  email: "user@example.com",
  firstName: "Jane",
  lastName: "Doe",
  signUpDate: new Date(),
  unsubscribed: false,
};

// Enroll starting from email #1 (welcome)
const scheduledEmails = await dripCampaign.enrollUserInCampaign(user, 1);
console.log(`Scheduled ${scheduledEmails.length} emails`);
```

#### Option 2: CLI Script

```bash
npm run enroll:new -- \
  --email=user@example.com \
  --first-name=Jane \
  --api-key=YOUR_RESEND_API_KEY
```

### For Existing Users

Enroll thousands of existing users starting from email #2 (since they've already been welcomed):

#### Using CSV File

Create a CSV file with your users:

```csv
email,firstName,lastName,signUpDate,unsubscribed
user1@example.com,John,Doe,2024-01-01,false
user2@example.com,Jane,Smith,2024-01-15,false
```

Run the migration:

```bash
npm run migrate:existing -- \
  --file=users.csv \
  --api-key=YOUR_RESEND_API_KEY
```

#### Using JSON File

```json
[
  {
    "email": "user1@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "signUpDate": "2024-01-01",
    "unsubscribed": false
  }
]
```

```bash
npm run migrate:existing -- \
  --file=users.json \
  --api-key=YOUR_RESEND_API_KEY
```

#### Dry Run Mode

Test the migration without sending emails:

```bash
npm run migrate:existing -- \
  --file=users.csv \
  --api-key=YOUR_RESEND_API_KEY \
  --dry-run
```

### Integration Examples

#### WorkOS Webhook

```typescript
import { DripCampaignService } from "@continuedev/email-drip-campaign";

const dripCampaign = new DripCampaignService(process.env.RESEND_API_KEY);

// Handle WorkOS user.created event
app.post("/webhooks/workos", async (req, res) => {
  const event = req.body;

  if (event.event === "user.created") {
    const user = {
      id: event.data.id,
      email: event.data.email,
      firstName: event.data.first_name,
      lastName: event.data.last_name,
      signUpDate: new Date(),
    };

    await dripCampaign.enrollUserInCampaign(user, 1);
  }

  res.json({ received: true });
});
```

#### Daily Batch Processing

```typescript
// Run as a cron job to process yesterday's signups
import { DripCampaignService } from "@continuedev/email-drip-campaign";

const dripCampaign = new DripCampaignService(process.env.RESEND_API_KEY);

async function processYesterdaySignups() {
  // Fetch yesterday's signups from your database
  const newUsers = await db.users.findNewSignups(yesterday);

  // Enroll in batch (10 at a time to respect rate limits)
  const result = await dripCampaign.enrollUsersBatch(newUsers, 1, 10);

  console.log(`Enrolled: ${result.successful}, Failed: ${result.failed}`);
}
```

#### Unsubscribe Handler

```typescript
app.get("/unsubscribe/:userId", async (req, res) => {
  const { userId } = req.params;

  // Get scheduled emails for this user from your database
  const scheduledEmails = await db.getScheduledEmails(userId);

  // Cancel remaining emails
  await dripCampaign.unsubscribeUser(scheduledEmails);

  // Mark user as unsubscribed in your database
  await db.users.update(userId, { unsubscribed: true });

  res.send("You have been unsubscribed");
});
```

## Email Templates

All email templates are in `src/templates/` and built with React Email.

### Customizing Templates

1. Edit the template files directly (e.g., `WelcomeEmail.tsx`)
2. Add media URLs for GIFs or short videos
3. Update links to point to your documentation
4. Rebuild: `npm run build`

### Previewing Templates

Use React Email's dev server to preview templates:

```bash
npm run email:dev
```

This will open a browser at `http://localhost:3000` where you can see all templates.

### Adding Media

Replace placeholder images with actual media:

```tsx
<Img
  src="https://your-cdn.com/welcome-video.gif"
  alt="Welcome to Continue"
  style={mediaImage}
/>
```

For videos, you can use animated GIFs or link to a landing page with the video.

## Configuration

### Email Timing

Edit `src/types/index.ts` to change when emails are sent:

```typescript
export const DRIP_CAMPAIGN_EMAILS: DripCampaignEmail[] = [
  {
    emailNumber: 1,
    subject: "Welcome to Continue - Let's Get Started!",
    scheduledDaysAfterSignup: 0, // Immediate
  },
  {
    emailNumber: 2,
    subject: "Your First Week with Continue: Key Features",
    scheduledDaysAfterSignup: 7, // 1 week
  },
  // ... customize as needed
];
```

### Email Content

Subject lines and content can be updated in:

- Subject lines: `src/types/index.ts`
- Email body: Individual template files in `src/templates/`

### From Email Address

Configure in the service initialization:

```typescript
const dripCampaign = new DripCampaignService(
  apiKey,
  "onboarding@continue.dev", // Your from address
);
```

## Testing

### Send Test Emails

```typescript
const dripCampaign = new DripCampaignService(process.env.RESEND_API_KEY);

// Test specific email
await dripCampaign.sendTestEmail("your-email@example.com", 1);
```

### Unit Tests

```bash
npm test
```

## Migration Report

When migrating existing users, a detailed report is generated:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "summary": {
    "totalUsersInFile": 1000,
    "activeUsers": 950,
    "unsubscribedUsers": 50,
    "enrolledSuccessfully": 945,
    "enrollmentFailed": 5
  }
}
```

Reports are saved in the same directory as your input file.

## Troubleshooting

### Rate Limits

Resend has rate limits on their API. The default batch size is 10 users at a time with 1-second delays between batches. Adjust if needed:

```typescript
await dripCampaign.enrollUsersBatch(users, 2, 20); // Batch size: 20
```

### Failed Emails

Check the migration report for failed enrollments. Common issues:

- Invalid email addresses
- Resend API quota exceeded
- Network timeouts

### Email Delivery

Emails may take a few minutes to arrive. Check:

1. Resend dashboard for send status
2. Spam folder
3. Email logs in Resend

### Scheduling Limits

Resend can schedule emails up to 30 days in advance. For campaigns longer than 30 days, you'll need to implement your own scheduling system or use a database to track and reschedule emails.

## API Reference

### DripCampaignService

Main service class for managing the drip campaign.

#### Constructor

```typescript
new DripCampaignService(apiKey: string, fromEmail?: string)
```

#### Methods

**enrollUserInCampaign(user, startFromEmail)**

Enroll a single user in the campaign.

- `user`: User object with email, firstName, etc.
- `startFromEmail`: Which email to start from (1-4, default: 1)
- Returns: `Promise<ScheduledEmail[]>`

**enrollUsersBatch(users, startFromEmail, batchSize)**

Enroll multiple users in batches.

- `users`: Array of User objects
- `startFromEmail`: Which email to start from (default: 2 for existing users)
- `batchSize`: Number to process at once (default: 10)
- Returns: `Promise<{ successful, failed, results }>`

**sendTestEmail(toEmail, emailNumber)**

Send a test email.

- `toEmail`: Recipient email
- `emailNumber`: Which email to test (1-4)
- Returns: `Promise<boolean>`

**unsubscribeUser(scheduledEmails)**

Cancel all scheduled emails for a user.

- `scheduledEmails`: Array of ScheduledEmail objects
- Returns: `Promise<{ canceled, failed }>`

## Architecture

```
packages/email-drip-campaign/
├── src/
│   ├── templates/          # React Email templates
│   │   ├── WelcomeEmail.tsx
│   │   ├── WeekOneEmail.tsx
│   │   ├── WeekTwoEmail.tsx
│   │   └── WeekThreeEmail.tsx
│   ├── services/           # Business logic
│   │   └── DripCampaignService.ts
│   ├── types/              # TypeScript types
│   │   └── index.ts
│   ├── scripts/            # CLI scripts
│   │   ├── migrateExistingUsers.ts
│   │   └── enrollNewUser.ts
│   ├── examples/           # Integration examples
│   │   └── integrationExamples.ts
│   └── index.ts            # Package exports
├── package.json
├── tsconfig.json
└── README.md
```

## Best Practices

1. **Test First**: Always test with a small batch before migrating thousands of users
2. **Use Dry Run**: Use `--dry-run` flag to validate your data first
3. **Monitor Delivery**: Check Resend dashboard for delivery rates and issues
4. **Respect Unsubscribes**: Always check user.unsubscribed before enrolling
5. **Batch Processing**: Process large user lists in batches to avoid rate limits
6. **Track Scheduled Emails**: Store scheduled email IDs in your database for unsubscribe handling
7. **Set SPF/DKIM**: Configure your domain in Resend for better deliverability
8. **A/B Testing**: Test different subject lines and content with small groups first

## Next Steps

1. **Add Analytics**: Track open rates and click-through rates using Resend webhooks
2. **Dynamic Content**: Customize content based on user behavior or preferences
3. **A/B Testing**: Test different email variants to optimize engagement
4. **Segmentation**: Create different drip campaigns for different user segments
5. **Re-engagement**: Create a separate campaign for inactive users
6. **Feedback Loop**: Use email responses to improve content and timing

## Support

- [Resend Documentation](https://resend.com/docs)
- [React Email Documentation](https://react.email/docs)
- [Continue Documentation](https://docs.continue.dev)

## License

See the root repository LICENSE file.
