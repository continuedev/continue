# Simple rebuild script to verify our changes work
Write-Host "Building Continue with Databricks Claude integration..."
npm run build

# Check the exit code
if ($LASTEXITCODE -eq 0) {
    Write-Host "Build successful! The type errors have been fixed."
} else {
    Write-Host "Build failed. Please check the error messages above."
}
