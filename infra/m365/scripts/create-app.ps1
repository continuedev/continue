<#
Parametros:
 -Env <dev|staging|prod>
 -DisplayName <nombre base>
 -RedirectUris <array>
 -DryRun switch : si se pasa, no hace cambios, solo muestra lo que haría

Requisitos:
 - Azure CLI (az) instalado y autenticado
 - Permisos para crear App Registrations y Service Principals (Azure AD)
 - Az CLI extension 'azure-dev' no es necesaria; usamos 'az ad' y Microsoft Graph
#>
param(
    [Parameter(Mandatory=$true)] [ValidateSet('dev','staging','prod')] [string]$Env,
    [Parameter(Mandatory=$false)] [string]$DisplayName = "SIGE-App-$Env",
    [string[]]$RedirectUris = @("https://localhost:5001/signin-oidc"),
    [switch]$DryRun
)

function Exec {
    param($cmd)
    if ($DryRun) { Write-Host "DRYRUN: $cmd"; return }
    Write-Host "RUN: $cmd"
    iex $cmd
}

# 1) Crear App Registration
$manifestPath = "infra/m365/manifests/app-manifest.json"
$appName = $DisplayName

# Load template and patch env-specific values
$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
$manifest.displayName = $appName
$manifest.web.redirectUris = $RedirectUris

$tempManifest = [System.IO.Path]::GetTempFileName()
$manifest | ConvertTo-Json -Depth 10 | Out-File -FilePath $tempManifest -Encoding utf8

$createCmd = "az ad app create --display-name `"$appName`" --available-to-other-tenants false --reply-urls `"$($RedirectUris -join ' ')`" --output json"

if ($DryRun) {
    Write-Host "Would create app with name: $appName"
    Write-Host "Manifest (patched):`n" + ($manifest | ConvertTo-Json -Depth 10)
    Remove-Item $tempManifest -ErrorAction SilentlyContinue
    exit 0
}

$app = az ad app create --display-name "$appName" --reply-urls $RedirectUris --output json | ConvertFrom-Json
Write-Host "App created: $($app.appId)"

# 2) Create Service Principal
$sp = az ad sp create --id $app.appId --output json | ConvertFrom-Json
Write-Host "Service Principal created: $($sp.id)"

# 3) Create client secret (valid 730 days by default)
$secretDesc = "sigedev-$Env-$(Get-Date -Format yyyyMMddHHmm)"
$pwd = az ad app credential reset --id $app.appId --append --display-name $secretDesc --years 2 --query "{clientId:appId, password:password, startDate:startDate, endDate:endDate}" --output json | ConvertFrom-Json
Write-Host "Secret created for appId: $($pwd.clientId)"
Write-Host "Secret (store immediately in Key Vault): $($pwd.password)"

# Output helpful info (do NOT auto-store unless subsequent script called)
$result = [PSCustomObject]@{
    AppId = $app.appId
    AppObjectId = $app.id
    ServicePrincipalId = $sp.id
    ClientSecret = $pwd.password
    SecretStart = $pwd.startDate
    SecretEnd = $pwd.endDate
}
$result | ConvertTo-Json -Depth 5

# Cleanup
Remove-Item $tempManifest -ErrorAction SilentlyContinue

Write-Host "Done. IMPORTANT: store the ClientSecret in Key Vault using store-secret-in-kv.ps1 and do NOT check secrets into source control."
