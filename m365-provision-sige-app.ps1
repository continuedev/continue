<# PowerShell script to provision Azure AD App Registration and store secret in Key Vault
   Run in Azure Cloud Shell (PowerShell) or local PowerShell with Azure CLI and Az module installed.
   Edit variables and run: .\m365-provision-sige-app.ps1
#>
param()

$AppName = "SIGE-Dev-App"
$RedirectUri = "https://localhost"
$ResourceGroup = "<your-resource-group>"
$Location = "eastus"
$KeyVaultName = "<your-keyvault-name>"

Write-Output "Creating app registration: $AppName"
$app = az ad app create --display-name $AppName --sign-in-audience AzureADMyOrg --web-redirect-uris $RedirectUri --query "{appId:appId}" -o json | ConvertFrom-Json
$appId = $app.appId
if (-not $appId) { throw "Failed to create app" }

Write-Output "Creating service principal"
az ad sp create --id $appId | Out-Null

Write-Output "Creating client secret (2 years)"
$secret = az ad app credential reset --id $appId --append --years 2 --query password -o tsv
Write-Output "AppId: $appId"

# Ensure resource group
if (-not (az group show -n $ResourceGroup -o none 2>$null)) {
  az group create -n $ResourceGroup -l $Location | Out-Null
}

# Create Key Vault
if (-not (az keyvault show -n $KeyVaultName -o none 2>$null)) {
  az keyvault create -n $KeyVaultName -g $ResourceGroup -l $Location --sku standard | Out-Null
}

Write-Output "Storing secret in Key Vault: $KeyVaultName"
az keyvault secret set --vault-name $KeyVaultName -n "SIGE-Dev-App-ClientSecret" --value $secret | Out-Null

Write-Output "DONE. AppId: $appId. Secret stored in Key Vault: $KeyVaultName (SIGE-Dev-App-ClientSecret)"
Write-Output "Next steps: add delegated API permissions (Sites.Read.All, Group.Read.All, offline_access, openid, User.Read) and grant admin consent in Azure Portal."
