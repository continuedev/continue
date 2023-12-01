while IFS= read -r line
do
    # Extract the module name (before '==')
    module=$(echo "$line" | cut -d'=' -f1)
   
    fgrep "$module" req.txt
done < "server/requirements.txt"