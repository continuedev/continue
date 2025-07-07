#!/bin/bash

# Simple checker for broken images and links in Mintlify documentation

echo "🔍 Checking for broken images and missing files..."
echo ""

broken_count=0

# Check for missing images
echo "📷 Missing Images:"
echo "=================="
while IFS= read -r line; do
    file=$(echo "$line" | cut -d: -f1)
    img_path=$(echo "$line" | grep -o '/images/[^)]*)' | sed 's/)$//')
    
    if [ ! -f ".${img_path}" ]; then
        echo "❌ $file → $img_path"
        broken_count=$((broken_count + 1))
    fi
done < <(grep -r '!\[.*\](/images/' . --include="*.mdx")

echo ""
echo "🔗 Missing Linked Files:"
echo "========================"
while IFS= read -r line; do
    file=$(echo "$line" | cut -d: -f1)
    link_path=$(echo "$line" | grep -o '/customize/[^)]*)' | sed 's/)$//' | cut -d'#' -f1)
    
    if [ ! -f ".${link_path}.mdx" ]; then
        echo "❌ $file → $link_path"
        broken_count=$((broken_count + 1))
    fi
done < <(grep -r '\[.*\](/customize/' . --include="*.mdx")

echo ""
echo "📊 Summary: $broken_count issues found"

# List available images for reference
echo ""
echo "Available images in /images/:"
find ./images -name "*.png" -o -name "*.gif" -o -name "*.jpg" | head -20
echo "... (showing first 20)"