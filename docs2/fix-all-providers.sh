#!/bin/bash

# Fix all remaining issues in model provider files

find ./customize/model-providers -name "*.mdx" -o -name "*.md" | while read -r file; do
    echo "Processing: $file"
    
    # Fix malformed closing tags
    sed -i.bak 's/:::</Info>/g' "$file"
    sed -i.bak 's/:::/<\/Info>/g' "$file"
    sed -i.bak 's/:::warning/<Warning>/g' "$file"
    sed -i.bak 's/:::note/<Note>/g' "$file" 
    sed -i.bak 's/:::tip/<Tip>/g' "$file"
    sed -i.bak 's/:::caution/<Warning>/g' "$file"
    
    # Remove any leftover triple colons
    sed -i.bak 's/:::.*//g' "$file"
    
    # Clean up double tags
    sed -i.bak 's/<Info><Info>/<Info>/g' "$file"
    sed -i.bak 's/<\/Info><\/Info>/<\/Info>/g' "$file"
    sed -i.bak 's/<Warning><Warning>/<Warning>/g' "$file"
    sed -i.bak 's/<\/Warning><\/Warning>/<\/Warning>/g' "$file"
    
    # Remove backup files
    rm -f "$file.bak"
done

echo "Fixed all model provider files completely"