#!/bin/bash

# Fix code blocks for better Mintlify syntax highlighting
# This script adds language specifications to code blocks where appropriate

echo "🔍 Analyzing code blocks..."

# Count current code blocks
echo "📊 Current code block stats:"
echo "Total code blocks: $(find . -name "*.mdx" -exec grep -c "^\`\`\`" {} + | awk '{sum+=$1} END {print sum}')"
echo "Blocks with language: $(find . -name "*.mdx" -exec grep -c "^\`\`\`[a-z]" {} + | awk '{sum+=$1} END {print sum}')"

echo ""
echo "🔧 Fixing common code block patterns..."

# Fix JSON config blocks
echo "  📝 Adding json language to config.json blocks..."
find . -name "*.mdx" -exec sed -i.bak '/```[[:space:]]*$/N; /```[[:space:]]*\nconfig\.json/s/```[[:space:]]*\nconfig\.json/```json\nconfig.json/' {} \;

# Fix YAML config blocks  
echo "  📝 Adding yaml language to config.yaml blocks..."
find . -name "*.mdx" -exec sed -i.bak '/```[[:space:]]*$/N; /```[[:space:]]*\nconfig\.yaml/s/```[[:space:]]*\nconfig\.yaml/```yaml\nconfig.yaml/' {} \;

# Fix common patterns for JSON content (looking for opening braces)
echo "  📝 Adding json language to blocks starting with { ..."
find . -name "*.mdx" -exec sed -i.bak '/```[[:space:]]*$/N; /```[[:space:]]*\n{/s/```[[:space:]]*\n{/```json\n{/' {} \;

# Fix shell/bash commands
echo "  📝 Adding bash language to command blocks starting with $ ..."
find . -name "*.mdx" -exec sed -i.bak '/```[[:space:]]*$/N; /```[[:space:]]*\n\$/s/```[[:space:]]*\n\$/```bash\n$/' {} \;

# Clean up backup files
echo "  🧹 Cleaning up backup files..."
find . -name "*.bak" -delete

echo ""
echo "✅ Code block fixing complete!"

# Show updated stats
echo "📊 Updated code block stats:"
echo "Total code blocks: $(find . -name "*.mdx" -exec grep -c "^\`\`\`" {} + | awk '{sum+=$1} END {print sum}')"
echo "Blocks with language: $(find . -name "*.mdx" -exec grep -c "^\`\`\`[a-z]" {} + | awk '{sum+=$1} END {print sum}')"

echo ""
echo "🔍 Sample of improved code blocks:"
find . -name "*.mdx" -exec grep -A2 "^\`\`\`[a-z]" {} + | head -10