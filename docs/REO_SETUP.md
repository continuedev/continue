# Reo.dev Tracking Setup Instructions

## Status: ⚠️ PENDING - Needs Reo.dev Snippet

The infrastructure is ready, but the actual Reo.dev tracking snippet needs to be added.

## What's Been Done

1. ✅ Created `docs/reo-tracking.js` as a placeholder for the Reo.dev snippet
2. ✅ Updated `docs/docs.json` to include the tracking script in custom JS
3. ✅ Documented implementation approach

## Next Steps

### 1. Obtain Reo.dev Tracking Snippet

1. Go to: https://web.reo.dev/dashboard/integration/documentation
2. Navigate to: **Integrations >> Tracking Beacon >> Documentations >> Method 1: Using CDN**
3. Copy the JavaScript code snippet provided

### 2. Update the Tracking File

Open `docs/reo-tracking.js` and replace the entire file content with the snippet from step 1.

**Important:** Remove the placeholder code and paste only the actual Reo.dev snippet.

### 3. Configure Documentation URL in Reo.dev Dashboard

In the Reo.dev dashboard, configure:

- **Base Documentation URL:** `https://docs.continue.dev`
- **Title:** `Continue Documentation`

### 4. Configure Key Pages (High-Intent Tracking)

Add these high-intent pages to track in the Reo.dev dashboard under "Key Pages":

- `https://docs.continue.dev/troubleshooting` - Troubleshooting guide
- `https://docs.continue.dev/reference` - API Reference
- `https://docs.continue.dev/ide-extensions/install` - Installation guide
- `https://docs.continue.dev/ide-extensions/*/quick-start` - Quick start guides
- `https://docs.continue.dev/customize/model-providers/*` - Model provider setup
- `https://docs.continue.dev/guides/*` - All guides

### 5. CSP Configuration (If Needed)

If the docs site uses Content Security Policy, you may need to add:

```
script-src https://static.reo.dev;
connect-src https://api.reo.dev;
```

### 6. Testing

After adding the real snippet:

1. Run the docs locally:

   ```bash
   cd docs
   npm install
   npm run dev
   ```

2. Open the documentation in your browser

3. Open browser DevTools (F12 or Cmd+Option+I)

4. Go to the Elements/Inspector tab

5. Press Ctrl+F (or Cmd+F) and search for "reo"

6. Verify the tracking code is present and loaded

7. Check the Console tab for any errors

### 7. Deploy

Once verified locally:

1. Commit the changes with the actual Reo.dev snippet
2. Deploy to production
3. Verify on the live site using the same testing steps

## File Structure

```
docs/
├── docs.json           # Mintlify config (updated to include reo-tracking.js)
├── reo-tracking.js     # Reo.dev tracking snippet (needs actual snippet)
└── REO_SETUP.md        # This file
```

## Support

- Reo.dev Documentation: https://docs.reo.dev/integrations/tracking-beacon/install-javascript-for-documentation
- Reo.dev Dashboard: https://web.reo.dev/dashboard/integration/documentation
- GitHub Issue: https://github.com/continuedev/continue/issues/8671
