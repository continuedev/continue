#!/bin/bash
# Provision Azure AD App + Service Principal and store client secret in Key Vault
# Run in Azure Cloud Shell (bash) or local az-authenticated shell
# Usage: edit variables below and run: bash m365-provision-sige-app.sh

set -euo pipefail

APP_NAME="SIGE-Dev-App"
REDIRECT_URI="https://localhost"
RESOURCE_GROUP="<your-resource-group>"   # create or reuse
LOCATION="eastus"
KEYVAULT_NAME="<your-keyvault-name>"  # must be unique

echo "Creating app registration: $APP_NAME"
appId=$(az ad app create --display-name "$APP_NAME" --sign-in-audience AzureADMyOrg --web-redirect-uris "$REDIRECT_URI" --query appId -o tsv)
if [ -z "$appId" ]; then
  echo "Failed to create app"; exit 1
fi

echo "Creating service principal for appId: $appId"
az ad sp create --id "$appId" >/dev/null

echo "Creating client secret (2 years)"
secret=$(az ad app credential reset --id "$appId" --append --years 2 --query password -o tsv)

echo "AppId: $appId"
echo "Client secret generated (store it safely)"

# Create resource group if needed
if ! az group show -n "$RESOURCE_GROUP" >/dev/null 2>&1; then
  echo "Creating resource group $RESOURCE_GROUP"
  az group create -n "$RESOURCE_GROUP" -l "$LOCATION" >/dev/null
fi

# Create Key Vault (if not exists) and store secret
if ! az keyvault show -n "$KEYVAULT_NAME" >/dev/null 2>&1; then
  echo "Creating Key Vault $KEYVAULT_NAME in $RESOURCE_GROUP"
  az keyvault create -n "$KEYVAULT_NAME" -g "$RESOURCE_GROUP" -l "$LOCATION" --sku standard >/dev/null
fi

echo "Storing secret in Key Vault: $KEYVAULT_NAME"
az keyvault secret set --vault-name "$KEYVAULT_NAME" -n "SIGE-Dev-App-ClientSecret" --value "$secret" >/dev/null

cat <<EOF
DONE
AppId: $appId
KeyVault: $KEYVAULT_NAME (secret name: SIGE-Dev-App-ClientSecret)
Next steps:
 - In Azure Portal, go to App Registrations -> $APP_NAME -> API Permissions and add delegated permissions: Sites.Read.All, Group.Read.All, offline_access, openid, User.Read. Then grant admin consent.
 - For write scenarios, create a separate App Registration with application permissions and explicit admin consent.
 - Use secrets from Key Vault in your app runtime or store in GitHub Secrets for CI if needed.
EOF
