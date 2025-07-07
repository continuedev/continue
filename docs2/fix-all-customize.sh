#!/bin/bash

# Fix all customize files to use Mintlify components

find ./customize -name "*.mdx" | while read -r file; do
    echo "Processing: $file"
    
    # Convert :::info blocks to <Info> components
    sed -i.bak 's/:::info/<Info>/g' "$file"
    sed -i.bak 's/:::warning/<Warning>/g' "$file"
    sed -i.bak 's/:::note/<Note>/g' "$file"
    sed -i.bak 's/:::tip/<Tip>/g' "$file"
    sed -i.bak 's/:::caution/<Warning>/g' "$file"
    
    # Fix closing tags - replace standalone ::: with </Info>
    sed -i.bak 's/^:::$/<\/Info>/g' "$file"
    
    # Remove Docusaurus imports
    sed -i.bak '/import TabItem from "@theme\/TabItem";/d' "$file"
    sed -i.bak '/import Tabs from "@theme\/Tabs";/d' "$file"
    
    # Convert Docusaurus Tabs to Mintlify Tabs
    sed -i.bak 's/<Tabs groupId="[^"]*">/<Tabs>/g' "$file"
    sed -i.bak 's/<TabItem value="[^"]*" label="\([^"]*\)">/<Tab title="\1">/g' "$file"
    sed -i.bak 's/<\/TabItem>/<\/Tab>/g' "$file"
    
    # Clean up any double tags
    sed -i.bak 's/<Info><Info>/<Info>/g' "$file"
    sed -i.bak 's/<\/Info><\/Info>/<\/Info>/g' "$file"
    sed -i.bak 's/<Warning><Warning>/<Warning>/g' "$file"
    sed -i.bak 's/<\/Warning><\/Warning>/<\/Warning>/g' "$file"
    
    # Remove backup files
    rm -f "$file.bak"
done

echo "Fixed all customize files for Mintlify compatibility"