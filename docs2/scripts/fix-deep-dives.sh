#!/bin/bash

# Fix deep-dives files for Mintlify compatibility

echo "Fixing deep-dives files..."

# Function to fix a single file
fix_file() {
    local file="$1"
    echo "Processing: $file"
    
    # Fix image paths from /img/ to /images/
    sed -i.bak 's|/img/|/images/|g' "$file"
    
    # Fix relative image paths that might be broken
    sed -i.bak 's|!\[([^]]*)\]((?!\/images\/)[^/)][^)]*\.(?:png|jpg|jpeg|gif|svg))|![(\1)](/images/\2)|g' "$file"
    
    # Remove any remaining malformed code block endings
    sed -i.bak 's/````/```/g' "$file"
    
    # Remove backup files
    rm -f "$file.bak"
}

# Fix all deep-dives files
for file in ./customize/deep-dives/*.mdx; do
    if [[ -f "$file" ]]; then
        fix_file "$file"
    fi
done

# Add titles to files that might be missing them
files_needing_titles=(
    "./customize/deep-dives/configuration.mdx:Configuration"
    "./customize/deep-dives/autocomplete.mdx:Autocomplete Deep Dive"
    "./customize/deep-dives/development-data.mdx:Development Data"
    "./customize/deep-dives/prompts.mdx:Prompts"
    "./customize/deep-dives/slash-commands.mdx:Slash Commands"
    "./customize/deep-dives/vscode-actions.mdx:VS Code Actions"
    "./customize/deep-dives/mcp.mdx:Model Context Protocol"
)

for item in "${files_needing_titles[@]}"; do
    file="${item%%:*}"
    title="${item##*:}"
    
    if [[ -f "$file" ]]; then
        # Check if file has title in frontmatter
        if ! grep -q "^title:" "$file"; then
            echo "Adding title to: $file"
            # Add title to frontmatter or create frontmatter if missing
            if grep -q "^---" "$file"; then
                # Frontmatter exists, add title
                sed -i.bak "2i\\
title: \"$title\"" "$file"
            else
                # No frontmatter, create it
                {
                    echo "---"
                    echo "title: \"$title\""
                    echo "---"
                    echo ""
                    cat "$file"
                } > "$file.tmp"
                mv "$file.tmp" "$file"
            fi
            rm -f "$file.bak"
        fi
    fi
done

echo "Fixed all deep-dives files"