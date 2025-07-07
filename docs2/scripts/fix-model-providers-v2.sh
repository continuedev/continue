#!/bin/bash

# Fix all model provider files to use Mintlify components instead of Docusaurus

# Find all .mdx and .md files in model-providers directory
find ./customize/model-providers -name "*.mdx" -o -name "*.md" | while read -r file; do
    echo "Processing: $file"
    
    # Fix the broken closing tags from the previous script
    sed -i.bak 's/:::</Info>/g' "$file"
    
    # Remove backup files
    rm -f "$file.bak"
done

echo "Fixed closing tags in all model provider files"