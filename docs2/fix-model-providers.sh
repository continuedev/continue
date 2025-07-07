#!/bin/bash

# Fix all model provider files to use Mintlify components instead of Docusaurus

# Find all .mdx and .md files in model-providers directory
find ./customize/model-providers -name "*.mdx" -o -name "*.md" | while read -r file; do
    echo "Processing: $file"
    
    # Convert :::info blocks to <Info> components
    sed -i.bak 's/:::info/<Info>/g' "$file"
    sed -i.bak 's/:::/</Info>/g' "$file"
    
    # Convert :::warning blocks to <Warning> components  
    sed -i.bak 's/:::warning/<Warning>/g' "$file"
    
    # Convert :::note blocks to <Note> components
    sed -i.bak 's/:::note/<Note>/g' "$file"
    
    # Convert :::tip blocks to <Tip> components
    sed -i.bak 's/:::tip/<Tip>/g' "$file"
    
    # Convert :::caution blocks to <Warning> components (Mintlify equivalent)
    sed -i.bak 's/:::caution/<Warning>/g' "$file"
    
    # Remove Docusaurus imports
    sed -i.bak '/import TabItem from "@theme\/TabItem";/d' "$file"
    sed -i.bak '/import Tabs from "@theme\/Tabs";/d' "$file"
    
    # Convert Docusaurus Tabs to Mintlify Tabs
    sed -i.bak 's/<Tabs groupId="[^"]*">/<Tabs>/g' "$file"
    sed -i.bak 's/<TabItem value="[^"]*" label="\([^"]*\)">/<Tab title="\1">/g' "$file"
    sed -i.bak 's/<\/TabItem>/<\/Tab>/g' "$file"
    sed -i.bak 's/<\/Tabs>/<\/Tabs>/g' "$file"
    
    # Clean up any double Info/Warning tags that might have been created
    sed -i.bak 's/<Info><Info>/<Info>/g' "$file"
    sed -i.bak 's/<\/Info><\/Info>/<\/Info>/g' "$file"
    sed -i.bak 's/<Warning><Warning>/<Warning>/g' "$file"
    sed -i.bak 's/<\/Warning><\/Warning>/<\/Warning>/g' "$file"
    
    # Remove backup files
    rm -f "$file.bak"
done

echo "Fixed all model provider files for Mintlify compatibility"