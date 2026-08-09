<#
PowerShell: Automatización básica para aplicar etiquetas de sensibilidad usando Microsoft Graph
Requisitos:
- Registrar una app en Azure AD con permisos (Application):
  - InformationProtectionPolicy.ReadWrite.All (o Delegated + admin consent)
  - Sites.ReadWrite.All
  - Files.ReadWrite.All
  - offline_access
- Proveer TenantId, ClientId y ClientSecret (o usar certificado)

NOTA: Verificar los endpoints concretos en la documentación de Microsoft Graph para su inquilino y versión. Este script es un punto de partida y contiene placeholders que debe reemplazar.
Docs útiles:
- https://learn.microsoft.com/graph/security-sensitivity-labels
- https://learn.microsoft.com/graph/api/resources/informationprotection?view=graph-rest-1.0
#>

param(
    [Parameter(Mandatory=$true)] [string]$TenantId,
    [Parameter(Mandatory=$true)] [string]$ClientId,
    [Parameter(Mandatory=$true)] [string]$ClientSecret,
    [Parameter(Mandatory=$true)] [string]$LabelDisplayName,
    [Parameter(Mandatory=$true)] [string]$DriveId,
    [Parameter(Mandatory=$true)] [string]$ItemId
)

function Get-GraphToken {
    param($TenantId,$ClientId,$ClientSecret)
    $body = @{
        client_id     = $ClientId
        scope         = "https://graph.microsoft.com/.default"
        client_secret = $ClientSecret
        grant_type    = 'client_credentials'
    }
    $tokenResponse = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$TenantId/oauth2/v2.0/token" -Body $body -ContentType "application/x-www-form-urlencoded"
    return $tokenResponse.access_token
}

function Get-LabelIdByName {
    param($token,$labelName)
    $uri = "https://graph.microsoft.com/v1.0/informationProtection/sensitivityLabels"
    $headers = @{ Authorization = "Bearer $token" }
    $resp = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get
    # Buscar coincidencia por displayName
    foreach ($lab in $resp.value) {
        if ($lab.displayName -eq $labelName) { return $lab.id }
    }
    return $null
}

function Apply-LabelToDriveItem {
    param($token,$driveId,$itemId,$labelId)
    # Microsoft Graph exposes acciones relacionadas con informationProtection; la ruta /drives/{driveId}/items/{itemId}/informationProtection/label/apply es un ejemplo.
    # Revise la doc oficial para el endpoint exacto o use el SDK.

    $uri = "https://graph.microsoft.com/v1.0/drives/$driveId/items/$itemId/informationProtection/label/apply"
    $headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }
    $body = @{ labelId = $labelId; assignmentMethod = 'standard' } | ConvertTo-Json

    try {
        $resp = Invoke-RestMethod -Uri $uri -Headers $headers -Method Post -Body $body
        Write-Output "Label applied: $($resp | ConvertTo-Json -Depth 4)"
    }
    catch {
        Write-Error "Apply failed: $($_.Exception.Response.StatusCode) - $($_.Exception.Message)"
        $raw = $_.Exception.Response.GetResponseStream(); $sr = New-Object System.IO.StreamReader($raw); $sr.ReadToEnd()
    }
}

# --- Main ---
$token = Get-GraphToken -TenantId $TenantId -ClientId $ClientId -ClientSecret $ClientSecret
if (-not $token) { Write-Error "No se obtuvo token"; exit 1 }

$labelId = Get-LabelIdByName -token $token -labelName $LabelDisplayName
if (-not $labelId) { Write-Error "Etiqueta '$LabelDisplayName' no encontrada. Cree la etiqueta en Purview y reintente."; exit 2 }

Write-Output "Etiqueta encontrada: $labelId. Aplicando a DriveId=$DriveId ItemId=$ItemId"
Apply-LabelToDriveItem -token $token -driveId $DriveId -itemId $ItemId -labelId $labelId

# Para operación a gran escala:
# - Enumerar items en site/drive mediante /sites/{siteId}/drive/root:/path:/children
# - Para cada item que cumpla condiciones (regex o metadatos), llamar Apply-LabelToDriveItem
# - Mantener tasa de llamadas y manejo de errores (retry/backoff)

# Recomendación: probar en entorno piloto con un grupo limitado de archivos y activar logs (Auditing) para verificar resultados.

