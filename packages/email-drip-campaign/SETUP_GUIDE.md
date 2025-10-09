# Email Drip Campaign Setup Guide

This guide will walk you through setting up and deploying the email drip campaign system for Continue.

## Prerequisites

- Node.js 18+ installed
- A [Resend](https://resend.com) account with API key
- Access to your user database (WorkOS, Loops.so, or other)
- Domain configured in Resend (for production)

## Step 1: Resend Configuration

### 1.1 Create Resend Account

1. Sign up at [resend.com](https://resend.com)
2. Verify your email address

### 1.2 Domain Setup (Production)

For production, you need to configure your domain:

1. Go to [resend.com/domains](https://resend.com/domains)
2. Add your domain (e.g., `continue.dev`)
3. Add DNS records to your domain:
   - **SPF Record**: Add TXT record for email authentication
   - **DKIM Records**: Add CNAME records for email signing
4. Wait for verification (usually takes a few minutes)

For testing, you can use Resend's `onboarding@resend.dev` without domain setup.

### 1.3 Get API Key

1. Go to [resend.com/api-keys](https://resend.com/api-keys)
2. Create a new API key
3. Copy the key (starts with `re_`)

## Step 2: Install and Build

```bash
cd packages/email-drip-campaign
npm install
npm run build
```

## Step 3: Configure Environment

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
RESEND_API_KEY=re_your_actual_api_key
FROM_EMAIL=onboarding@continue.dev  # Use your verified domain
```

## Step 4: Customize Email Templates

### 4.1 Update Content

Edit templates in `src/templates/`:

- `WelcomeEmail.tsx` - Welcome message
- `WeekOneEmail.tsx` - Week 1 features
- `WeekTwoEmail.tsx` - Week 2 advanced features
- `WeekThreeEmail.tsx` - Week 3 pro tips

### 4.2 Add Media

Replace placeholder images with actual GIFs or videos:

1. Upload media to your CDN or hosting (e.g., CloudFlare, S3)
2. Update image URLs in templates:

```tsx
<Img
  src="https://cdn.continue.dev/emails/welcome.gif"
  alt="Welcome to Continue"
  style={mediaImage}
/>
```

### 4.3 Preview Templates

Run the development server:

```bash
npm run email:dev
```

Open `http://localhost:3000` to preview all templates.

### 4.4 Rebuild

After making changes:

```bash
npm run build
```

## Step 5: Test with Sample Data

### 5.1 Send Test Emails

Create a test script:

```typescript
// test.ts
import { DripCampaignService } from "./dist/services/DripCampaignService";

const service = new DripCampaignService(
  process.env.RESEND_API_KEY!,
  process.env.FROM_EMAIL,
);

async function test() {
  // Test each email
  for (let i = 1; i <= 4; i++) {
    await service.sendTestEmail("your-email@example.com", i as any);
    console.log(`Sent test email #${i}`);
  }
}

test();
```

Run:

```bash
npx ts-node test.ts
```

### 5.2 Dry Run Migration

Test with sample data:

```bash
npm run migrate:existing -- \
  --file=examples/users-sample.csv \
  --api-key=$RESEND_API_KEY \
  --dry-run
```

## Step 6: Migrate Existing Users

### 6.1 Export Users from WorkOS/Loops

#### From WorkOS

Use WorkOS API or dashboard to export users. Format as CSV or JSON:

```csv
email,firstName,lastName,signUpDate,unsubscribed
user@example.com,John,Doe,2024-01-01,false
```

#### From Loops.so

1. Export contacts from Loops dashboard
2. Map fields to required format
3. Save as CSV or JSON

### 6.2 Prepare User File

Ensure your file has these fields:

- `email` (required)
- `firstName` (optional but recommended)
- `lastName` (optional)
- `signUpDate` (optional, defaults to current date)
- `unsubscribed` (optional, defaults to false)

### 6.3 Run Migration

**Small batch test (10 users):**

```bash
npm run migrate:existing -- \
  --file=users-test.csv \
  --api-key=$RESEND_API_KEY
```

**Full migration:**

```bash
npm run migrate:existing -- \
  --file=all-users.csv \
  --api-key=$RESEND_API_KEY \
  --batch-size=10
```

This will:

- Skip unsubscribed users
- Enroll active users starting from email #2
- Generate a migration report
- Handle rate limits automatically

### 6.4 Review Results

Check the generated reports:

- `migration-report-*.json` - Summary statistics
- `migration-results-*.json` - Detailed per-user results

## Step 7: Set Up New User Enrollment

Choose one of these approaches:

### Option A: Direct Integration (Recommended)

Add to your signup handler:

```typescript
import { DripCampaignService } from "@continuedev/email-drip-campaign";

const dripCampaign = new DripCampaignService(
  process.env.RESEND_API_KEY,
  "onboarding@continue.dev",
);

// In your signup function
async function handleUserSignup(email: string, firstName?: string) {
  // ... your existing signup logic ...

  // Enroll in drip campaign
  const user = {
    id: userId,
    email,
    firstName,
    signUpDate: new Date(),
  };

  await dripCampaign.enrollUserInCampaign(user, 1);
}
```

### Option B: Webhook Handler

Create a webhook endpoint:

```typescript
import express from "express";
import { DripCampaignService } from "@continuedev/email-drip-campaign";

const app = express();
const dripCampaign = new DripCampaignService(process.env.RESEND_API_KEY);

app.post("/webhooks/user-signup", async (req, res) => {
  const { email, firstName, lastName } = req.body;

  const user = {
    id: email,
    email,
    firstName,
    lastName,
    signUpDate: new Date(),
  };

  await dripCampaign.enrollUserInCampaign(user, 1);

  res.json({ success: true });
});

app.listen(3000);
```

### Option C: Daily Batch Cron Job

Create a cron job to process signups daily:

```typescript
// cron-daily-signups.ts
import { DripCampaignService } from "@continuedev/email-drip-campaign";

const dripCampaign = new DripCampaignService(process.env.RESEND_API_KEY);

async function processYesterdaySignups() {
  // Fetch yesterday's signups from your database
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const newUsers = await fetchNewSignups(yesterday);

  // Enroll in batch
  const result = await dripCampaign.enrollUsersBatch(newUsers, 1, 10);

  console.log(`Enrolled ${result.successful} users`);
}

processYesterdaySignups();
```

Add to crontab:

```bash
# Run daily at 9 AM
0 9 * * * /usr/bin/node /path/to/cron-daily-signups.js
```

## Step 8: Set Up Unsubscribe Handling

### 8.1 Store Scheduled Email IDs

When enrolling users, store the scheduled email IDs:

```typescript
const scheduledEmails = await dripCampaign.enrollUserInCampaign(user, 1);

// Store in your database
await db.scheduledEmails.insertMany(
  scheduledEmails.map((email) => ({
    userId: user.id,
    resendEmailId: email.resendScheduledId,
    emailNumber: email.emailNumber,
    scheduledFor: email.scheduledFor,
  })),
);
```

### 8.2 Create Unsubscribe Endpoint

```typescript
app.get("/unsubscribe/:userId", async (req, res) => {
  const { userId } = req.params;

  // Get scheduled emails from database
  const scheduledEmails = await db.scheduledEmails.find({
    userId,
    sent: false,
  });

  // Cancel in Resend
  await dripCampaign.unsubscribeUser(scheduledEmails);

  // Mark user as unsubscribed
  await db.users.update(userId, { unsubscribed: true });

  res.send("Successfully unsubscribed");
});
```

### 8.3 Update Email Templates

The unsubscribe link in templates uses a placeholder:

```tsx
<Link href={`{{unsubscribeUrl}}`}>Unsubscribe</Link>
```

Resend automatically replaces this with the proper unsubscribe URL.

## Step 9: Monitor and Maintain

### 9.1 Resend Dashboard

Monitor email delivery:

1. Go to [resend.com/emails](https://resend.com/emails)
2. View sent, delivered, opened, and clicked statistics
3. Check for bounces or spam complaints

### 9.2 Set Up Webhooks (Optional)

Track email events:

```typescript
app.post("/webhooks/resend", (req, res) => {
  const event = req.body;

  switch (event.type) {
    case "email.delivered":
      // Track delivery
      break;
    case "email.opened":
      // Track opens
      break;
    case "email.clicked":
      // Track clicks
      break;
    case "email.bounced":
      // Handle bounces
      break;
  }

  res.json({ received: true });
});
```

### 9.3 Regular Maintenance

- Review delivery rates weekly
- Check for spam complaints
- Update content based on user feedback
- A/B test subject lines and content
- Monitor unsubscribe rates

## Step 10: Scaling Considerations

### For High Volume (>10,000 users/day)

1. **Use a Queue System**: Implement Redis/Bull queue for processing
2. **Distributed Processing**: Run multiple workers
3. **Rate Limit Management**: Adjust batch sizes
4. **Database Optimization**: Index scheduled_emails table
5. **Monitoring**: Set up alerts for failures

### Example with Bull Queue

```typescript
import Queue from "bull";

const enrollmentQueue = new Queue("email-enrollment", {
  redis: { host: "localhost", port: 6379 },
});

// Add job
await enrollmentQueue.add({ userId, email, firstName });

// Process job
enrollmentQueue.process(async (job) => {
  const { userId, email, firstName } = job.data;
  await dripCampaign.enrollUserInCampaign(
    {
      id: userId,
      email,
      firstName,
      signUpDate: new Date(),
    },
    1,
  );
});
```

## Troubleshooting

### Issue: Emails not sending

**Check:**

1. API key is correct
2. Domain is verified in Resend
3. FROM_EMAIL matches verified domain
4. Rate limits not exceeded

### Issue: Emails going to spam

**Solutions:**

1. Verify SPF and DKIM records
2. Warm up your domain (start with small volumes)
3. Avoid spam trigger words
4. Include unsubscribe link
5. Monitor spam complaints in Resend dashboard

### Issue: Scheduled emails not appearing

**Check:**

1. Scheduled date is within 30 days
2. Resend API response includes email ID
3. Check Resend dashboard for scheduled emails

### Issue: Rate limit errors

**Solutions:**

1. Reduce batch size
2. Increase delay between batches
3. Upgrade Resend plan
4. Implement retry logic

## Production Checklist

Before going live:

- [ ] Domain verified in Resend
- [ ] SPF and DKIM records configured
- [ ] Test emails received successfully
- [ ] Unsubscribe flow tested
- [ ] Migration tested with small batch
- [ ] Monitoring set up
- [ ] Error handling in place
- [ ] Rate limit handling configured
- [ ] Backup plan for failures
- [ ] Team trained on system

## Support

For issues or questions:

- Check [Resend Documentation](https://resend.com/docs)
- Review [React Email Docs](https://react.email/docs)
- Contact team lead

## Next Steps

After successful deployment:

1. Monitor first week of emails
2. Collect user feedback
3. A/B test subject lines
4. Optimize send times
5. Create additional drip sequences
6. Implement advanced segmentation
