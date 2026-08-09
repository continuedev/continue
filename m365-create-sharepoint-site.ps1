<# Create a SharePoint team site (Group-connected) using PnP.PowerShell
   Run in PowerShell (Cloud Shell or local) after installing PnP.PowerShell module.
#>

# Install PnP if needed (uncomment to install)
# Install-Module -Name PnP.PowerShell -Force -Scope CurrentUser

$AdminUrl = "https://<your-tenant>-admin.sharepoint.com"  # e.g. https://contoso-admin.sharepoint.com
$SiteTitle = "SIGE Pilot"
$SiteAlias = "sige-pilot"
$Owners = @("risanchezc@udd.cl")

Write-Output "Connect to SharePoint admin and create site"
Connect-PnPOnline -Url $AdminUrl -Interactive

New-PnPSite -Type TeamSite -Title $SiteTitle -Alias $SiteAlias -Owners $Owners -Lcid 3082

Write-Output "Site created. Next: configure libraries, metadata and owners via PnP or portal."
