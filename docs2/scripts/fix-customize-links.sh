#!/bin/bash

# Fix broken /customize/ links to point to correct paths

echo "🔧 Fixing /customize/ link references..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

fixed_count=0

# Map of incorrect /customize/ paths to correct paths
declare -A link_mappings=(
    ["/customize/model-roles/edit"]="/customization/models#edit-model-role"
    ["/customize/model-roles/apply"]="/customization/models#apply-model-role" 
    ["/customize/model-roles/autocomplete"]="/customization/models#autocomplete-model-role"
    ["/customize/model-roles/chat"]="/customization/models#chat-model-role"
    ["/customize/model-roles/embeddings"]="/customization/models#embeddings-model-role"
    ["/customize/model-roles/reranking"]="/customization/models#reranking-model-role"
    ["/customize/model-roles/intro"]="/customization/models"
    ["/customize/deep-dives/autocomplete"]="/customization/models#autocomplete-deep-dive"
    ["/customize/deep-dives/prompts"]="/customization/prompts"
    ["/customize/deep-dives/rules"]="/customization/rules"
    ["/customize/deep-dives/mcp"]="/customization/mcp-tools"
    ["/customize/deep-dives/configuration"]="/customization/overview"
    ["/customize/deep-dives/slash-commands"]="/customization/overview#slash-commands"
    ["/customize/deep-dives/development-data"]="/customization/overview#development-data"
    ["/customize/deep-dives/vscode-actions"]="/customization/overview#vscode-actions"
    ["/customize/model-providers/openai"]="/customization/models#openai-provider"
    ["/customize/context/codebase"]="/customization/overview#codebase-context"
    ["/customize/context/documentation"]="/customization/overview#documentation-context"
    ["/customize/settings"]="/customize/settings"
    ["/customize/telemetry"]="/customize/telemetry"
    ["/customize/custom-providers"]="/customize/custom-providers"
    ["/customize/json-reference"]="/customize/json-reference"
    ["/customize/yaml-migration"]="/customize/yaml-migration"
)

echo "📝 Applying link mappings..."

# Apply the mappings
for old_path in "${!link_mappings[@]}"; do
    new_path="${link_mappings[$old_path]}"
    
    # Escape special characters for sed
    old_escaped=$(echo "$old_path" | sed 's/[[\.*^$()+?{|]/\\&/g')
    new_escaped=$(echo "$new_path" | sed 's/[[\.*^$()+?{|]/\\&/g')
    
    # Find and replace in all MDX files
    if grep -r "$old_path" . --include="*.mdx" >/dev/null 2>&1; then
        find . -name "*.mdx" -exec sed -i.bak "s|$old_escaped|$new_escaped|g" {} \;
        echo "✅ Fixed: $old_path → $new_path"
        fixed_count=$((fixed_count + 1))
    fi
done

# Clean up backup files
find . -name "*.bak" -delete

echo ""
echo "📊 Summary: Applied $fixed_count link fixes"

# Check if /customize directory should be removed
echo ""
echo "🗂️  Directory analysis:"
echo "customization/ - Main customize tab content (keep)"
echo "customize/ - Contains some valid content that should be preserved"

echo ""
echo "⚠️  Note: /customize/ directory contains some legitimate content:"
echo "   - settings.mdx"
echo "   - json-reference.mdx" 
echo "   - custom-providers.mdx"
echo "   - telemetry.mdx"
echo "   - yaml-migration.mdx"
echo ""
echo "These should be kept and properly linked in mint.json"

echo ""
echo "🔍 Checking remaining broken /customize/ links..."
remaining=$(grep -r '/customize/' . --include="*.mdx" | grep -v -E '(settings|json-reference|custom-providers|telemetry|yaml-migration)' | wc -l)
echo "Remaining problematic /customize/ references: $remaining"