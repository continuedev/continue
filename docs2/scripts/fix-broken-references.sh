#!/bin/bash

# Comprehensive fix for broken images and missing references in Mintlify migration

echo "🔧 Fixing broken images and references..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

fixed_count=0

# Step 1: Copy missing images from build assets
echo "📷 Copying missing hashed images from build assets..."
docs_build="/Users/briandouglas/code/continue/docs/build/assets/images"
docs_static="/Users/briandouglas/code/continue/docs/static/img"

if [ -d "$docs_build" ]; then
    # Copy all hashed images
    cp "$docs_build"/* ./images/ 2>/dev/null
    echo "✅ Copied hashed images from build assets"
    fixed_count=$((fixed_count + 1))
else
    echo "⚠️  Build assets directory not found"
fi

# Step 2: Copy any missing static images  
if [ -d "$docs_static" ]; then
    # Copy non-hashed images that might be missing
    for img in "$docs_static"/*; do
        filename=$(basename "$img")
        if [ ! -f "./images/$filename" ]; then
            cp "$img" ./images/
            echo "✅ Copied missing static image: $filename"
            fixed_count=$((fixed_count + 1))
        fi
    done
else
    echo "⚠️  Static images directory not found"
fi

# Step 3: Create missing directory structure
echo ""
echo "📁 Creating missing subdirectories..."
missing_dirs=(
    "images/customization/images"
    "images/features/agent/images" 
    "images/features/edit/images"
    "images/getting-started/images"
    "images/guides/images"
    "images/hub/blocks/images"
    "images/hub/assistants/images"
    "images/hub/governance/images"
    "images/hub/images"
    "images/customize/images"
)

for dir in "${missing_dirs[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo "✅ Created directory: $dir"
        fixed_count=$((fixed_count + 1))
    fi
done

# Step 4: Map and copy specific missing images
echo ""
echo "🔗 Mapping specific missing images..."

# Known mappings from filename patterns
declare -A image_mappings=(
    ["configure-continue-a5c8c79f3304c08353f3fc727aa5da7e.png"]="configure-continue.png"
    ["prompts-blocks-overview-17194d870840576f9a0dde548f2c70ec.png"]="prompts-blocks-overview.png"
    ["model-blocks-overview-36c30e7e01928d7a9b5b26ff1639c34b.png"]="model-blocks-overview.png"
    ["mcp-blocks-overview-c9a104f9b586779c156f9cf34da197c2.png"]="mcp-blocks-overview.png"
    ["agent-permission-c150919a5c43eb4f55d9d4a46ef8b2d6.png"]="agent-permission.png"
    ["agent-response-c7287c82aac93fb4376f9d85b352b2d7.png"]="agent-response.png"
    ["select-edit-mode-75c8f01861ebe03177986a5b7f21f746.png"]="select-edit-mode.png"
    ["chat-489b68d156be2aafe09ee7cedf233fba.gif"]="chat.gif"
    ["autocomplete-9d4e3f7658d3e65b8e8b20f2de939675.gif"]="autocomplete.gif"
    ["edit-d522442f88e715924b4c9f4c83900e3a.gif"]="edit.gif"
    ["agent-9ef792cfc196a3b5faa984fb072c4400.gif"]="agent.gif"
    ["move-to-right-sidebar-b2d315296198e41046fc174d8178f30a.gif"]="move-to-right-sidebar.gif"
    ["jetbrains-getting-started-d62b7edee1cdd58508c5075faf285955.png"]="jetbrains-getting-started.png"
    ["continue-console-d387a10c2918c117c6c253a3b5f18c22.png"]="continue-console.png"
    ["prerelease-9bed93e846914165d30a3b227a680d9b.png"]="prerelease.png"
    ["settings-header-acd40f47f47b56a0baf63be6c8780077.png"]="settings-header.png"
    ["settings-page-4a14934bc9f99cce5e11424f2c9b6be2.png"]="settings-page.png"
    ["context-provider-example-0c96ff77286fa970b23dddfdc1fa986a.png"]="context-provider-example.png"
)

# Copy and create mappings
for hashed_name in "${!image_mappings[@]}"; do
    original_name="${image_mappings[$hashed_name]}"
    
    # Copy to flat structure
    if [ -f "./images/$hashed_name" ] && [ ! -f "./images/$original_name" ]; then
        cp "./images/$hashed_name" "./images/$original_name"
        echo "✅ Mapped: $hashed_name → $original_name"
        fixed_count=$((fixed_count + 1))
    fi
    
    # Copy to nested directories as needed
    for subdir in "customization/images" "features/agent/images" "features/edit/images" "getting-started/images" "customize/images" "guides/images" "hub/blocks/images" "hub/assistants/images" "hub/governance/images" "hub/images"; do
        target_dir="./images/$subdir"
        if [ -f "./images/$hashed_name" ] && [ ! -f "$target_dir/$original_name" ]; then
            cp "./images/$hashed_name" "$target_dir/$original_name"
            echo "✅ Copied to $target_dir/$original_name"
            fixed_count=$((fixed_count + 1))
        fi
    done
done

# Step 5: Fix /assets/files references
echo ""
echo "📄 Fixing /assets/files references..."
find . -name "*.mdx" -exec sed -i.bak 's|/assets/files/|/images/|g' {} \;
if [ $? -eq 0 ]; then
    echo "✅ Fixed /assets/files references"
    fixed_count=$((fixed_count + 1))
fi

# Step 6: Copy any files from /assets/files if they exist
docs_assets="/Users/briandouglas/code/continue/docs/static/assets/files"
if [ -d "$docs_assets" ]; then
    cp "$docs_assets"/* ./images/ 2>/dev/null
    echo "✅ Copied files from assets/files"
    fixed_count=$((fixed_count + 1))
fi

# Step 7: Clean up backup files
echo ""
echo "🧹 Cleaning up..."
find . -name "*.bak" -delete

echo ""
echo "📊 Summary"
echo "=========="
echo -e "${GREEN}✅ Applied $fixed_count fixes${NC}"

# Run our checker to see remaining issues
echo ""
echo "🔍 Checking remaining issues..."
echo "=============================="

remaining_images=0
remaining_links=0

# Quick check for remaining broken images
while IFS= read -r line; do
    file=$(echo "$line" | cut -d: -f1)
    img_path=$(echo "$line" | grep -o '/images/[^)]*)' | sed 's/)$//')
    
    if [ ! -f ".${img_path}" ]; then
        if [ $remaining_images -eq 0 ]; then
            echo "❌ Remaining broken images:"
        fi
        echo "   $file → $img_path"
        remaining_images=$((remaining_images + 1))
    fi
done < <(grep -r '!\[.*\](/images/' . --include="*.mdx" 2>/dev/null)

# Quick check for remaining broken links to customize/
while IFS= read -r line; do
    file=$(echo "$line" | cut -d: -f1)
    link_path=$(echo "$line" | grep -o '/customize/[^)]*)' | sed 's/)$//' | cut -d'#' -f1)
    
    if [ ! -f ".${link_path}.mdx" ]; then
        if [ $remaining_links -eq 0 ]; then
            echo "❌ Remaining broken links:"
        fi
        echo "   $file → $link_path"
        remaining_links=$((remaining_links + 1))
    fi
done < <(grep -r '\[.*\](/customize/' . --include="*.mdx" 2>/dev/null)

echo ""
if [ $remaining_images -eq 0 ] && [ $remaining_links -eq 0 ]; then
    echo -e "${GREEN}🎉 All image and link issues resolved!${NC}"
else
    echo -e "${YELLOW}⚠️  $remaining_images broken images and $remaining_links broken links remaining${NC}"
    echo "   These may need manual review or indicate missing content files"
fi

echo ""
echo "📄 Image inventory:"
echo "Total images in /images: $(find ./images -name "*.png" -o -name "*.gif" -o -name "*.jpg" | wc -l)"