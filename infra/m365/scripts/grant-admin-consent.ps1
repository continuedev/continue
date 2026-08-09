<#
Ejemplos para conceder admin consent a una App Registration.
Opciones:
  - Usar portal (URL de admin consent)
  - Usar PowerShell + Microsoft Graph (requiere permisos suficientes)

1) URL de admin consent (manual):
https://login.microsoftonline.com/{tenant-id}/adminconsent?client_id={application-id}&state=12345&redirect_uri={encoded-redirect-uri}

2) PowerShell + Graph (ejemplo con Microsoft.Graph PowerShell module):
   - Install-Module Microsoft.Graph -Scope CurrentUser
   - Connect-MgGraph -Scopes "Application.ReadWrite.All","Directory.ReadWrite.All"
   - Grant using the ServicePrincipal and OAuth2PermissionGrants or AppRoleAssignment as needed.

Script ejemplo para conceder consentimiento de forma programática (necesita permisos de admin):
#>
param(
    [Parameter(Mandatory=$true)] [string]$TenantId,
    [Parameter(Mandatory=$true)] [string]$ClientId,
    [switch]$OpenAdminConsentUrl
)

if ($OpenAdminConsentUrl) {
    $redirect = [System.Uri]::EscapeDataString("https://localhost:5001/signin-oidc")
    $url = "https://login.microsoftonline.com/$TenantId/adminconsent?client_id=$ClientId&state=1&redirect_uri=$redirect"
    Write-Host "Open this URL as an admin to grant consent:`n$url"
    exit 0
}

Write-Host "Programmatic consent requires Graph admin privileges. Example manual URL printed with -OpenAdminConsentUrl."

# NOTE: Programmatic admin-consent steps vary by tenant and policies. Provide this script as a helper to generate the URL or as a template to run Graph calls with the right privileges.
