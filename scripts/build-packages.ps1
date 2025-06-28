Push-Location packages

Push-Location "openai-adapters"
npm ci
npm run build
Pop-Location

Push-Location "config-yaml"
npm ci
npm run build
Pop-Location

Pop-Location