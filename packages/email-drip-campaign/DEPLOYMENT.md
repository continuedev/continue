# Deployment Guide

Quick reference for deploying the email drip campaign system.

## Quick Start

### 1. Environment Setup

```bash
# Required environment variables
export RESEND_API_KEY=re_your_api_key
export FROM_EMAIL=onboarding@continue.dev
```

### 2. Install & Build

```bash
cd packages/email-drip-campaign
npm install
npm run build
```

### 3. Test

```bash
# Send test email
npm run enroll:new -- \
  --email=test@example.com \
  --first-name=Test \
  --api-key=$RESEND_API_KEY
```

## Deployment Options

### Option 1: Serverless Function (Recommended)

Deploy as a serverless function (AWS Lambda, Vercel, Netlify):

```typescript
// handler.ts
import { DripCampaignService } from "@continuedev/email-drip-campaign";

export const handler = async (event: any) => {
  const { email, firstName, lastName } = JSON.parse(event.body);

  const service = new DripCampaignService(
    process.env.RESEND_API_KEY,
    process.env.FROM_EMAIL,
  );

  const user = {
    id: email,
    email,
    firstName,
    lastName,
    signUpDate: new Date(),
  };

  const result = await service.enrollUserInCampaign(user, 1);

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, result }),
  };
};
```

### Option 2: Express Server

Deploy as part of your existing Node.js server:

```typescript
// server.ts
import express from "express";
import { DripCampaignService } from "@continuedev/email-drip-campaign";

const app = express();
app.use(express.json());

const service = new DripCampaignService(
  process.env.RESEND_API_KEY,
  process.env.FROM_EMAIL,
);

app.post("/api/enroll-user", async (req, res) => {
  const { email, firstName, lastName } = req.body;

  const user = {
    id: email,
    email,
    firstName,
    lastName,
    signUpDate: new Date(),
  };

  const result = await service.enrollUserInCampaign(user, 1);

  res.json({ success: true, result });
});

app.listen(3000);
```

### Option 3: Cron Job

Deploy as a scheduled job:

```typescript
// cron.ts
import { DripCampaignService } from "@continuedev/email-drip-campaign";
import { fetchNewSignups } from "./database";

const service = new DripCampaignService(
  process.env.RESEND_API_KEY,
  process.env.FROM_EMAIL,
);

async function processDaily() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const newUsers = await fetchNewSignups(yesterday);
  const result = await service.enrollUsersBatch(newUsers, 1, 10);

  console.log(`Enrolled ${result.successful}/${newUsers.length} users`);
}

processDaily();
```

Schedule with cron:

```bash
0 9 * * * /usr/bin/node /path/to/cron.js >> /var/log/drip-campaign.log 2>&1
```

## Integration Points

### WorkOS Webhook

```typescript
app.post("/webhooks/workos", async (req, res) => {
  const event = req.body;

  if (event.event === "user.created") {
    await service.enrollUserInCampaign(
      {
        id: event.data.id,
        email: event.data.email,
        firstName: event.data.first_name,
        lastName: event.data.last_name,
        signUpDate: new Date(),
      },
      1,
    );
  }

  res.json({ received: true });
});
```

### Direct Integration

```typescript
// In your signup handler
import { DripCampaignService } from "@continuedev/email-drip-campaign";

const service = new DripCampaignService(process.env.RESEND_API_KEY);

async function handleSignup(email: string, firstName: string) {
  // Your existing signup logic
  const user = await createUser(email, firstName);

  // Enroll in drip campaign
  await service.enrollUserInCampaign(
    {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      signUpDate: new Date(),
    },
    1,
  );
}
```

## Migration Steps

### Step 1: Export Existing Users

From WorkOS or Loops.so, export to CSV:

```csv
email,firstName,lastName,signUpDate,unsubscribed
user@example.com,John,Doe,2024-01-01,false
```

### Step 2: Dry Run

```bash
npm run migrate:existing -- \
  --file=users.csv \
  --api-key=$RESEND_API_KEY \
  --dry-run
```

### Step 3: Small Batch Test

```bash
# Test with first 10 users
head -11 users.csv > test-users.csv

npm run migrate:existing -- \
  --file=test-users.csv \
  --api-key=$RESEND_API_KEY
```

### Step 4: Full Migration

```bash
npm run migrate:existing -- \
  --file=users.csv \
  --api-key=$RESEND_API_KEY \
  --batch-size=10
```

### Step 5: Verify

Check the generated reports:

- `migration-report-*.json`
- `migration-results-*.json`

## Monitoring

### Resend Dashboard

Monitor at [resend.com/emails](https://resend.com/emails):

- Delivery rates
- Open rates (if tracking enabled)
- Bounce rates
- Spam complaints

### Application Logs

Log important events:

```typescript
const result = await service.enrollUserInCampaign(user, 1);
console.log(`[DRIP] Enrolled ${user.email}:`, {
  scheduled: result.length,
  emails: result.map((e) => ({
    number: e.emailNumber,
    scheduledFor: e.scheduledFor,
  })),
});
```

### Error Handling

```typescript
try {
  await service.enrollUserInCampaign(user, 1);
} catch (error) {
  console.error("[DRIP] Enrollment failed:", {
    user: user.email,
    error: error.message,
  });

  // Send to error tracking (Sentry, etc.)
  Sentry.captureException(error, {
    tags: { service: "drip-campaign" },
    extra: { userId: user.id, email: user.email },
  });
}
```

## Production Checklist

- [ ] Resend API key configured
- [ ] Domain verified in Resend
- [ ] SPF/DKIM records set
- [ ] Templates customized with actual content
- [ ] Media URLs updated (GIFs/videos)
- [ ] Test emails sent and received
- [ ] Unsubscribe flow tested
- [ ] Error handling in place
- [ ] Logging configured
- [ ] Monitoring set up
- [ ] Rate limits configured
- [ ] Backup plan documented

## Rollback Plan

If issues occur:

1. **Stop new enrollments**: Comment out enrollment code
2. **Cancel scheduled emails**: Use Resend API or dashboard
3. **Fix issues**: Update code/templates
4. **Re-test**: Send test emails
5. **Resume**: Re-enable enrollment

## Maintenance

### Weekly Tasks

- Check delivery rates
- Review error logs
- Monitor unsubscribe rates
- Check spam complaints

### Monthly Tasks

- Review and update content
- A/B test subject lines
- Analyze engagement metrics
- Update based on feedback

### Quarterly Tasks

- Review full campaign performance
- Update templates and timing
- Implement improvements
- Plan new sequences

## Support

- Resend Status: [status.resend.com](https://status.resend.com)
- Resend Docs: [resend.com/docs](https://resend.com/docs)
- Rate Limits: Check your plan at [resend.com/pricing](https://resend.com/pricing)
