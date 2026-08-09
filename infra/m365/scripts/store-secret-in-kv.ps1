<#
Guardar un secret en Azure Key Vault y asignar políticas básicas de acceso para la SP.
Parametros:
 -VaultName <string> Nombre del Key Vault (debe existir)
 -SecretName <string>
 -SecretValue <string> (si no se pasa, lee de stdin)
 -ServicePrincipalId <string> (opcional) : asignará una policy de acceso para get/list
 -DryRun switch

Requisitos:
 - az CLI autenticado
 - Permisos para escribir secretos en el Key Vault y asignar accesos (az keyvault set-policy)
#>
param(
    [Parameter(Mandatory=$true)] [string]$VaultName,
    [Parameter(Mandatory=$true)] [string]$SecretName,
    [string]$SecretValue,
    [string]$ServicePrincipalId,
    [switch]$DryRun
)

if (-not $SecretValue) {
    Write-Host "Enter secret value (will be read from stdin):"
    $SecretValue = Read-Host -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecretValue)
    $SecretValue = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
}

$cmdSet = "az keyvault secret set --vault-name `"$VaultName`" --name `"$SecretName`" --value `"$SecretValue`" --output json"
if ($DryRun) { Write-Host "DRYRUN: $cmdSet"; exit 0 }

$set = az keyvault secret set --vault-name $VaultName --name $SecretName --value $SecretValue --output json | ConvertFrom-Json
Write-Host "Secret stored in Key Vault: $($set.id)"

if ($ServicePrincipalId) {
    Write-Host "Granting get/list access to SP: $ServicePrincipalId"
    $cmdPolicy = "az keyvault set-policy --name `"$VaultName`" --object-id `"$ServicePrincipalId`" --secret-permissions get list"
    if ($DryRun) { Write-Host "DRYRUN: $cmdPolicy"; exit 0 }
    az keyvault set-policy --name $VaultName --object-id $ServicePrincipalId --secret-permissions get list | Out-Null
    Write-Host "Policy updated."
}

Write-Host "Done. Ensure RBAC/auditing configured on Key Vault for production.")
