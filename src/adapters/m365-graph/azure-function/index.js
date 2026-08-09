// Azure Function (HTTP trigger) example to handle Graph notifications
// This is a minimal example for the notification endpoint.
// For a real Azure Function app, follow Azure Functions project layout. This file demonstrates the handler logic.

module.exports = async function (context, req) {
  context.log('Notification received');

  // Handle validation challenge: Graph sends GET?validationToken=...
  if (req.method === 'GET' && req.query && req.query.validationToken) {
    context.log('Responding to validationToken');
    context.res = {
      status: 200,
      body: req.query.validationToken,
      headers: {
        'Content-Type': 'text/plain'
      }
    };
    return;
  }

  // POST notifications
  if (req.method === 'POST') {
    const body = req.body;
    if (!body || !body.value) {
      context.res = { status: 400, body: 'Expected notifications' };
      return;
    }

    // Example: simple in-memory dedupe (replace with durable storage)
    context.log('Notifications count:', body.value.length);
    body.value.forEach(n => {
      context.log('Notification', n.id, n.subscriptionId, n.resource);
      // validate clientState if used
      // enqueue reconciliation job to call deltaLink
    });

    context.res = { status: 202 };
    return;
  }

  context.res = { status: 405, body: 'Method not allowed' };
};
