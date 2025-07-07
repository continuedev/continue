#!/bin/bash

# Fix broken images in Mintlify migration
# This script handles base64 embedded images and missing image references

echo "🔍 Finding broken images in MDX files..."

# Find files with base64 embedded images
echo "📄 Files with base64 embedded images:"
grep -r "data:image" . --include="*.mdx" | cut -d: -f1 | sort -u

echo ""
echo "🖼️  Available images in /images directory:"
ls -la images/ | grep -E '\.(png|jpg|jpeg|gif|svg)$' | awk '{print $9}' | sort

echo ""
echo "🔧 Fixing known image mappings..."

# Fix agent mode selector image
if grep -q "data:image/png;base64" features/agent/quick-start.mdx; then
    echo "  ✅ Fixing agent mode selector image..."
    sed -i.bak 's|!\[How to select agent mode\](data:image/png;base64[^)]*)|![How to select agent mode](/images/mode-select-agent.png)|g' features/agent/quick-start.mdx
fi

# Fix any remaining /img/ references to /images/
echo "  🔄 Converting /img/ paths to /images/..."
find . -name "*.mdx" -exec sed -i.bak 's|/img/|/images/|g' {} \;

# Fix any remaining /static/img/ references
echo "  🔄 Converting /static/img/ paths to /images/..."
find . -name "*.mdx" -exec sed -i.bak 's|/static/img/|/images/|g' {} \;

# Clean up backup files
echo "  🧹 Cleaning up backup files..."
find . -name "*.bak" -delete

echo ""
echo "✅ Image fixing complete!"
echo ""
echo "🔍 Remaining issues to check manually:"
grep -r "data:image" . --include="*.mdx" | head -5 || echo "No base64 images found!"

echo ""
echo "📊 Image reference summary:"
echo "Files with /images/ references: $(grep -r "/images/" . --include="*.mdx" | wc -l)"
echo "Files with broken references: $(grep -r "!\[.*\](/" . --include="*.mdx" | grep -v "/images/" | wc -l)"