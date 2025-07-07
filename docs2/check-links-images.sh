#!/bin/bash

# Comprehensive link and image checker for Mintlify documentation
# This script validates all internal links and image references

echo "🔍 Checking links and images in Mintlify documentation..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
total_images=0
broken_images=0
total_links=0
broken_links=0

echo "📷 Checking images..."
echo "===================="

# Check image references in MDX files
find . -name "*.mdx" -exec grep -l '!\[.*\](' {} \; | while read -r file; do
    grep -o '!\[[^]]*\]([^)]\+)' "$file" | while read -r match; do
        total_images=$((total_images + 1))
        
        # Extract the image path using sed
        img_path=$(echo "$match" | sed 's/!\[[^]]*\](\([^)]*\))/\1/')
        
        # Skip external URLs
        if echo "$img_path" | grep -q '^https\?://'; then
            continue
        fi
        
        # Convert relative paths to absolute
        if echo "$img_path" | grep -q '^/'; then
            # Absolute path from root
            check_path=".${img_path}"
        else
            # Relative path
            dir=$(dirname "$file")
            check_path="$dir/$img_path"
        fi
        
        # Check if file exists
        if [ ! -f "$check_path" ]; then
            echo -e "${RED}❌ BROKEN IMAGE:${NC} $file"
            echo -e "   Missing: $img_path"
            echo -e "   Checked: $check_path"
            broken_images=$((broken_images + 1))
        fi
    done
done

# Also check HTML img tags
find . -name "*.mdx" -exec grep -l '<img' {} \; | while read -r file; do
    grep -o '<img[^>]*src="[^"]*"' "$file" | while read -r match; do
        total_images=$((total_images + 1))
        
        # Extract src path
        img_path=$(echo "$match" | sed 's/.*src="\([^"]*\)".*/\1/')
        
        # Skip external URLs
        if echo "$img_path" | grep -q '^https\?://'; then
            continue
        fi
        
        # Convert relative paths to absolute
        if echo "$img_path" | grep -q '^/'; then
            check_path=".${img_path}"
        else
            dir=$(dirname "$file")
            check_path="$dir/$img_path"
        fi
        
        if [ ! -f "$check_path" ]; then
            echo -e "${RED}❌ BROKEN IMG TAG:${NC} $file"
            echo -e "   Missing: $img_path"
            broken_images=$((broken_images + 1))
        fi
    done
done

echo ""
echo "🔗 Checking internal links..."
echo "============================="

# Check markdown links
find . -name "*.mdx" -exec grep -l '\[.*\](' {} \; | while read -r file; do
    grep -o '\[[^]]*\]([^)]\+)' "$file" | while read -r match; do
        total_links=$((total_links + 1))
        
        # Extract link path
        link_path=$(echo "$match" | sed 's/\[[^]]*\](\([^)]*\))/\1/')
        
        # Skip external URLs, anchors, and special links
        if echo "$link_path" | grep -qE '^(https?://|mailto:|#|tel:)'; then
            continue
        fi
        
        # Remove anchor from path
        clean_path=$(echo "$link_path" | cut -d'#' -f1)
        
        # Skip empty paths
        if [ -z "$clean_path" ]; then
            continue
        fi
        
        # Convert relative paths to absolute
        if echo "$clean_path" | grep -q '^/'; then
            check_path=".${clean_path}"
        else
            dir=$(dirname "$file")
            check_path="$dir/$clean_path"
        fi
        
        # Add .mdx extension if no extension present
        if ! echo "$check_path" | grep -q '\.[a-zA-Z]\+$'; then
            check_path="${check_path}.mdx"
        fi
        
        # Check if file exists
        if [ ! -f "$check_path" ]; then
            echo -e "${RED}❌ BROKEN LINK:${NC} $file"
            echo -e "   Missing: $link_path"
            echo -e "   Checked: $check_path"
            broken_links=$((broken_links + 1))
        fi
    done
done

echo ""
echo "📊 Summary"
echo "=========="
echo -e "Images: ${GREEN}$((total_images - broken_images)) OK${NC}, ${RED}$broken_images BROKEN${NC} (Total: $total_images)"
echo -e "Links:  ${GREEN}$((total_links - broken_links)) OK${NC}, ${RED}$broken_links BROKEN${NC} (Total: $total_links)"

echo ""
echo "🔧 Additional checks..."
echo "======================="

# Check for common issues
echo "Checking for common issues:"

# Base64 images
base64_count=$(find . -name "*.mdx" -exec grep -c "data:image" {} + 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
if [ "$base64_count" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found $base64_count base64 embedded images${NC}"
else
    echo -e "${GREEN}✅ No base64 embedded images found${NC}"
fi

# Absolute URLs pointing to docs.continue.dev
external_docs=$(find . -name "*.mdx" -exec grep -c "https://docs.continue.dev" {} + 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
if [ "$external_docs" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found $external_docs links to external docs.continue.dev${NC}"
    echo "   These should be converted to relative paths"
else
    echo -e "${GREEN}✅ No external docs.continue.dev links found${NC}"
fi

# Count total files
total_files=$(find . -name "*.mdx" | wc -l)
echo -e "${GREEN}📄 Total MDX files: $total_files${NC}"

echo ""
if [ "$broken_images" -eq 0 ] && [ "$broken_links" -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed! No broken links or images found.${NC}"
    exit 0
else
    echo -e "${RED}❌ Found issues that need to be fixed.${NC}"
    exit 1
fi