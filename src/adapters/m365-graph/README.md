M365 Graph delta sync & webhook adapter samples

Overview (Spanish)

Este directorio contiene ejemplos de adaptadores para sincronización delta y manejo de notificaciones (change notifications) usando Microsoft Graph. Incluye ejemplos en Node.js y Python, plantillas para crear suscripciones webhooks, ejemplo de Azure Function, Dockerfile y pasos de CI.

Estructura
- example_adapter.js (Node.js example)
- python/adapter.py (Python example)
- azure-function/index.js (Azure Function example)
- azure-function/Dockerfile
- github-actions.yml (CI sample)

Important notes
- These examples do NOT create subscriptions automatically. Use the provided templates/commands to create subscriptions manually.
- For production, store tokens, deltaLinks, and processed notification IDs in durable storage (database, cache). The samples use in-memory stores for clarity only.

Webhook subscription (Graph REST) template

POST https://graph.microsoft.com/v1.0/subscriptions
Headers:
  Authorization: Bearer <ACCESS_TOKEN>
  Content-Type: application/json

Body (example):
{
  "changeType": "created,updated,deleted",
  "notificationUrl": "https://yourapp.example.com/api/notifications",
  "resource": "/sites/{site-id}/lists/{list-id}/items",
  "expirationDateTime": "2026-09-09T23:23:45Z",
  "clientState": "<your-client-state-secret>"
}

Notes on verification: during subscription validation Graph will send an HTTP GET to your notification URL with a validationToken query parameter. Your endpoint must reply with the validationToken value in the response body (plain text) and a 200 OK status. Do NOT perform JSON encoding.

ClientState and replay protection
- Use clientState to validate that notifications come from a subscription you created. Compare the clientState in the notification payload with your expected value.
- For replay protection and deduplication: persist the notification "id" and the timestamp. Reject duplicate ids within a configured window (for example, 1 hour). If you require stronger replay protection, include per-notification nonces in your application logic, or rely on stored delta links to reconcile state.

Delta queries (sites/lists)

1) Initial sync (Node/Python samples show how to request the delta feed):
GET https://graph.microsoft.com/v1.0/sites/{site-id}/lists/{list-id}/items/delta?$select=id,fields

Follow the @odata.nextLink pages until you get an @odata.deltaLink. Persist the deltaLink.

2) Subsequent syncs: call the saved deltaLink (it is a full URL) to get only changes since the last delta. The response may also return patches and an updated deltaLink.

Subscription creation examples (curl)

curl -X POST "https://graph.microsoft.com/v1.0/subscriptions" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "changeType": "created,updated,deleted",
    "notificationUrl":"https://yourapp.example.com/api/notifications",
    "resource":"/sites/{site-id}/lists/{list-id}/items",
    "expirationDateTime":"2026-09-09T23:23:45Z",
    "clientState":"my-secret-client-state"
  }'

Do not forget to set a valid expirationDateTime according to Graph limits (subscriptions can be short-lived depending on resource).

Azure Function and Docker
- The azure-function example contains a minimal HTTP-trigger function to handle validation and notifications.
- Provided Dockerfile shows how to containerize a simple Node-based function for deployments to Azure Container Instances or other platforms.

CI (GitHub Actions)
- The provided workflow installs Node and Python, runs basic lint/tests for samples, and builds the Docker image for the Azure Function example.

Security
- Keep clientState secrets and app secrets in secure store (Key Vault, environment variables). Do not commit secrets to repo.
- Validate JWTs (if using Azure AD-issued tokens) for any protected endpoints that accept delegated app calls.

References
- Microsoft Graph change notifications: https://learn.microsoft.com/graph/webhooks
- Microsoft Graph delta query: https://learn.microsoft.com/graph/delta-query-overview



