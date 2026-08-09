<#
PnP.PowerShell script to create a Microsoft 365 Team site (Group-connected Team Site), document libraries and recommended site columns for a RAG pilot.

Usage (do NOT run without review):
  - Edit parameters below or pass them when invoking the script.
  - Authenticate with Connect-PnPOnline before running or use the script's interactive connection.

Requirements:
  - PnP.PowerShell module (Install-Module PnP.PowerShell)
  - Tenant admin or site creation permissions for New-PnPSite
  - Compliance/sensitivity label creation is performed via Microsoft Purview / Compliance Center outside this script (this script creates a RetentionLabel column as metadata placeholder).

This script is intentionally idempotent: checks for existing site lists/fields/termsets and skips creation when present.
#>

param(
    [Parameter(Mandatory=$true)] [string]$SiteUrl,            # e.g. https://contoso.sharepoint.com/sites/rag-pilot
    [Parameter(Mandatory=$true)] [string]$SiteTitle,          # e.g. "RAG Pilot - Zona RAG"
    [Parameter(Mandatory=$true)] [string]$Alias,              # e.g. rag-pilot
    [Parameter(Mandatory=$true)] [string[]]$Owners,           # e.g. @("admin@contoso.com")
    [string]$AdminCenterUrl = "https://contoso-admin.sharepoint.com"  # Replace with your tenant admin center URL if required for site creation
)

function Ensure-Connected {
    param([string]$Url)
    try {
        if (-not (Get-PnPConnection)) {
            Write-Host "Connecting interactively to $Url ..."
            Connect-PnPOnline -Url $Url -Interactive -ErrorAction Stop
        }
    }
    catch {
        throw "Unable to connect: $_"
    }
}

# Connect to tenant admin to create the group-connected team site (if required)
Ensure-Connected -Url $AdminCenterUrl

# Create the Team site (Group-connected) if it does not exist
$existing = Get-PnPTenantSite -Detailed | Where-Object { $_.Url -eq $SiteUrl }
if (-not $existing) {
    Write-Host "Creating Team site: $SiteTitle ($Alias) ..."
    # New-PnPSite requires tenant admin context in many tenants. If your environment uses a different pattern, adapt accordingly.
    New-PnPSite -Type TeamSite -Title $SiteTitle -Alias $Alias -Owners $Owners -IsPublic:$false
}
else {
    Write-Host "Site already exists: $SiteUrl - skipping creation"
}

# Connect to the site itself for list/column creation
Ensure-Connected -Url $SiteUrl

# Recommended libraries for RAG pilot
$libraries = @(
    @{ Title = 'RAG-Source-Docs'; Description = 'Original content sources for ingestion (PDFs, DOCX, HTML, etc.)' },
    @{ Title = 'RAG-Processed-Chunks'; Description = 'Chunked/split content prepared for embedding (metadata per chunk)'; },
    @{ Title = 'RAG-Embeddings-Index'; Description = 'Index/metadata for external embedding store references (not the vectors themselves)'; }
)

foreach ($lib in $libraries) {
    $exists = Get-PnPList -Identity $lib.Title -ErrorAction SilentlyContinue
    if (-not $exists) {
        Write-Host "Creating library: $($lib.Title)"
        New-PnPList -Title $lib.Title -Template DocumentLibrary -Description $lib.Description -OnQuickLaunch:$true
        # recommended library settings
        Set-PnPList -Identity $lib.Title -EnableVersioning $true -MajorVersions 50 -EnableMinorVersions $false
    }
    else { Write-Host "Library $($lib.Title) already exists - skipping" }
}

# Create site columns (idempotent)
function Ensure-Field {
    param(
        [string]$DisplayName,
        [string]$InternalName,
        [string]$Type,
        [hashtable]$AdditionalParameters
n    )
    $fld = Get-PnPField | Where-Object { $_.InternalName -eq $InternalName }
    if (-not $fld) {
        Write-Host "Creating site column: $DisplayName ($InternalName) Type=$Type"
        switch ($Type) {
            'User' {
                Add-PnPField -DisplayName $DisplayName -InternalName $InternalName -Type User -Group 'RAG Columns' -AddToDefaultView:$false
            }
            'Choice' {
                $choices = $AdditionalParameters.Choices
                Add-PnPField -DisplayName $DisplayName -InternalName $InternalName -Type Choice -Choices $choices -Group 'RAG Columns' -AddToDefaultView:$false
            }
            'Text' {
                Add-PnPField -DisplayName $DisplayName -InternalName $InternalName -Type Text -Group 'RAG Columns' -AddToDefaultView:$false
            }
            'DateTime' {
                Add-PnPField -DisplayName $DisplayName -InternalName $InternalName -Type DateTime -Group 'RAG Columns' -AddToDefaultView:$false
            }
            default {
                throw "Unhandled field type $Type"
            }
        }
    }
    else { Write-Host "Field $InternalName already exists - skipping" }
}

# Define recommended metadata fields
Ensure-Field -DisplayName 'Owner' -InternalName 'RAGOwner' -Type 'User' -AdditionalParameters $null
Ensure-Field -DisplayName 'Classification' -InternalName 'RAGClassification' -Type 'Choice' -AdditionalParameters @{ Choices = @('Public','Internal','Confidential','Restricted') }
Ensure-Field -DisplayName 'RetentionLabel' -InternalName 'RAGRetentionLabel' -Type 'Text' -AdditionalParameters $null
Ensure-Field -DisplayName 'SourceSystem' -InternalName 'RAGSourceSystem' -Type 'Text' -AdditionalParameters $null
Ensure-Field -DisplayName 'SourceId' -InternalName 'RAGSourceId' -Type 'Text' -AdditionalParameters $null
Ensure-Field -DisplayName 'ChunkId' -InternalName 'RAGChunkId' -Type 'Text' -AdditionalParameters $null
Ensure-Field -DisplayName 'ChunkOrder' -InternalName 'RAGChunkOrder' -Type 'Text' -AdditionalParameters $null
Ensure-Field -DisplayName 'Language' -InternalName 'RAGLanguage' -Type 'Choice' -AdditionalParameters @{ Choices = @('en','es','pt','fr','de','other') }
Ensure-Field -DisplayName 'IndexedAt' -InternalName 'RAGIndexedAt' -Type 'DateTime' -AdditionalParameters $null
Ensure-Field -DisplayName 'EmbeddingStatus' -InternalName 'RAGEmbeddingStatus' -Type 'Choice' -AdditionalParameters @{ Choices = @('pending','processed','failed') }

# Add site columns to each library and put them in the default view
foreach ($lib in $libraries) {
    $listTitle = $lib.Title
    Write-Host "Ensuring site columns are present in list: $listTitle"
    $siteFields = @('RAGOwner','RAGClassification','RAGRetentionLabel','RAGSourceSystem','RAGSourceId','RAGChunkId','RAGChunkOrder','RAGLanguage','RAGIndexedAt','RAGEmbeddingStatus')
    foreach ($f in $siteFields) {
        try {
            Add-PnPFieldToList -List $listTitle -Identity $f -ErrorAction SilentlyContinue
        }
        catch {
            Write-Host "Warning adding field $f to $listTitle: $_"
        }
    }
    # Create a default view that includes key metadata for easier discovery
    $viewExists = Get-PnPView -List $listTitle -Identity 'RAG Default View' -ErrorAction SilentlyContinue
    if (-not $viewExists) {
        Add-PnPView -List $listTitle -Title 'RAG Default View' -Fields @('FileLeafRef','RAGOwner','RAGClassification','RAGLanguage','RAGIndexedAt') -SetAsDefault
    }
}

# Optional: create a termset for high-level topics/taxonomy (managed metadata)
try {
    $termGroupName = 'RAG Taxonomy'
    $termStore = Get-PnPTermStore
    $termGroup = $termStore.Groups | Where-Object { $_.Name -eq $termGroupName }
    if (-not $termGroup) {
        Write-Host "Creating term group and termset for RAG topics"
        $termGroup = New-PnPTermGroup -Name $termGroupName
        $termSet = New-PnPTermSet -TermGroup $termGroupName -Name 'RAG Topics' -LCID 1033
        # add example terms - customize these later in the Term Store UI
        Add-PnPTerm -TermSet $termSet -Name 'HR'
        Add-PnPTerm -TermSet $termSet -Name 'Legal'
        Add-PnPTerm -TermSet $termSet -Name 'Product'
        Add-PnPTerm -TermSet $termSet -Name 'Support'
    }
    else { Write-Host "RAG Taxonomy term group already exists - skipping" }
}
catch {
    Write-Host "Term store automation skipped or failed: $_" 
}

Write-Host "PnP provisioning script completed (idempotent). Review the created lists/columns and update Purview labels and retention policies as needed." 
