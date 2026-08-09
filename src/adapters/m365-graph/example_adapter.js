/*
Node.js example adapter for Microsoft Graph delta queries and change notifications
Requirements:
  npm install express node-fetch msal @microsoft/microsoft-graph-client

This sample demonstrates:
- Obtaining an access token with MSAL (client credentials)
- Running an initial delta query for a list's items
- Persisting deltaLink (in-memory for sample)
- Exposing a /notifications endpoint for Graph change notifications
  - Handles validationToken GET challenge
  - Validates clientState in incoming notifications
  - Simple replay protection by storing recent notification ids in-memory

Note: For production use persistent storage, robust error handling, and secure secret management.
*/

const express = require('express');
const fetch = require('node-fetch');
const msal = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

// --- Configuration (move to env vars in prod) ---
const TENANT_ID = process.env.AZURE_TENANT_ID || '<tenant-id>';
const CLIENT_ID = process.env.AZURE_CLIENT_ID || '<client-id>';
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || '<client-secret>';
const SCOPE = ['https://graph.microsoft.com/.default'];
const EXPECTED_CLIENT_STATE = process.env.EXPECTED_CLIENT_STATE || 'my-secret-client-state';

// Resource identifiers to use in delta queries
const SITE_ID = process.env.SITE_ID || '<site-id>';
const LIST_ID = process.env.LIST_ID || '<list-id>';

// --- In-memory stores (replace with DB/cache in prod) ---
let persistedDeltaLink = null; // string
const recentNotificationIds = new Map(); // id -> timestamp
const NOTIFICATION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// --- MSAL client ---
const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    clientSecret: CLIENT_SECRET,
  },
};
const cca = new msal.ConfidentialClientApplication(msalConfig);

async function getAccessToken() {
  const resp = await cca.acquireTokenByClientCredential({ scopes: SCOPE });
  if (!resp || !resp.accessToken) throw new Error('Failed to acquire token');
  return resp.accessToken;
}

function createGraphClient(accessToken) {
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
}

// --- Delta query flow ---
async function initialDeltaSync() {
  const token = await getAccessToken();
  const client = createGraphClient(token);
  const endpoint = `/sites/${SITE_ID}/lists/${LIST_ID}/items/delta?$select=id,fields`;

  console.log('Starting initial delta sync:', endpoint);
  let page = await client.api(endpoint).get();

  while (page) {
    if (page.value && page.value.length) {
      // Process items
      page.value.forEach((it) => {
        console.log('Item change:', it.id, it.fields);
      });
    }

    if (page['@odata.nextLink']) {
      page = await client.api(page['@odata.nextLink']).get();
    } else if (page['@odata.deltaLink']) {
      persistedDeltaLink = page['@odata.deltaLink'];
      console.log('Persisted deltaLink:', persistedDeltaLink);
      break;
    } else {
      break;
    }
  }
}

async function pollDeltaLink() {
  if (!persistedDeltaLink) {
    console.log('No deltaLink present. Run initial sync first.');
    return;
  }
  const token = await getAccessToken();
  const client = createGraphClient(token);
  console.log('Calling deltaLink:', persistedDeltaLink);
  let page = await client.api(persistedDeltaLink).get();
  while (page) {
    if (page.value && page.value.length) {
      page.value.forEach((it) => {
        console.log('Delta change:', it.id, it.fields);
      });
    }
    if (page['@odata.nextLink']) {
      page = await client.api(page['@odata.nextLink']).get();
    } else if (page['@odata.deltaLink']) {
      persistedDeltaLink = page['@odata.deltaLink'];
      console.log('Updated deltaLink:', persistedDeltaLink);
      break;
    } else {
      break;
    }
  }
}

// --- Notification handling ---
function cleanupOldNotifications() {
  const cutoff = Date.now() - NOTIFICATION_WINDOW_MS;
  for (const [id, ts] of recentNotificationIds.entries()) {
    if (ts < cutoff) recentNotificationIds.delete(id);
  }
}

function isReplay(notificationId) {
  cleanupOldNotifications();
  return recentNotificationIds.has(notificationId);
}

function markProcessed(notificationId) {
  recentNotificationIds.set(notificationId, Date.now());
}

const app = express();
app.use(express.json());

// Validation endpoint: Graph may send GET with ?validationToken=...
app.get('/api/notifications', (req, res) => {
  const token = req.query.validationToken;
  if (token) {
    // Respond with plain text token
    res.status(200).send(token);
    return;
  }
  res.status(400).send('Expected validationToken or POST for notifications');
});

app.post('/api/notifications', (req, res) => {
  const body = req.body;

  // Graph sends notifications in body.value (array)
  if (!body || !body.value) {
    res.sendStatus(400);
    return;
  }

  body.value.forEach((notification) => {
    const nid = notification.id;
    const clientState = notification.clientState;

    // 1) verify expected clientState
    if (EXPECTED_CLIENT_STATE && clientState !== EXPECTED_CLIENT_STATE) {
      console.warn('clientState mismatch. Possible spoofed notification', clientState);
      return; // skip processing
    }

    // 2) replay protection
    if (isReplay(nid)) {
      console.log('Duplicate notification, ignoring:', nid);
      return;
    }
    markProcessed(nid);

    // 3) process notification: it includes subscriptionId, subscriptionExpirationDateTime, resource, tenantId, etc.
    console.log('Received notification:', notification.subscriptionId, notification.resource);

    // For guaranteed correctness, kick off a delta sync for the targeted resource to reconcile state
    // Option: enqueue a background job to call the saved deltaLink or initial sync

  });

  // Acknowledge receipt quickly
  res.sendStatus(202);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Adapter listening on port ${PORT}`);
});

// Exported utilities for CLI usage
module.exports = { initialDeltaSync, pollDeltaLink };

// If run directly, demonstrate initial sync
if (require.main === module) {
  (async () => {
    try {
      await initialDeltaSync();
      console.log('Initial sync complete. Persist the deltaLink for future polls.');
    } catch (err) {
      console.error('Initial sync failed:', err);
    }
  })();
}
