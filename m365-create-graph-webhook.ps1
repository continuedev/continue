<# Create a Microsoft Graph subscription (change notification) for a SharePoint list
   Requires an OAuth token with the appropriate permissions and a reachable HTTPS notificationUrl.
   Run in PowerShell (Cloud Shell) using az to get access token, or adapt to use Invoke-RestMethod with token.
#>

$siteId = "<site-id>"          # get via Graph: /sites/{hostname}:/sites/{sitePath}
$listId = "<list-id>"          # list resource id
$notificationUrl = "https://<your-public-endpoint>/api/notifications"  # must be HTTPS and reachable
$expiration = (Get-Date).AddMinutes(60).ToString("o") # max 4230 minutes for some resources; adjust as needed

# Get Graph token using az
$token = az account get-access-token --resource https://graph.microsoft.com --query accessToken -o tsv

$body = @{ "changeType" = "created,updated,deleted"; "notificationUrl" = $notificationUrl; "resource" = "sites/$siteId/lists/$listId"; "expirationDateTime" = $expiration; "clientState" = "sige-secret-clientstate" } | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "https://graph.microsoft.com/v1.0/subscriptions" -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } -Body $body

Write-Output "Subscription created (or error shown). Keep clientState secret and validate on receipt."
