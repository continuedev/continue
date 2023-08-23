from collections import defaultdict

# Initialize a dictionary to store the sizes of the folders
folder_sizes = defaultdict(int)

# Parse the file
with open(
    "archive_contents.txt", "r"
) as f:  # replace 'file.txt' with your file name
    for line in f:
        parts = line.split(",")
        if len(parts) < 2:
            continue
        size = int(parts[1].strip())  # get the size
        path = parts[-1].strip()  # get the path

        # Split the path into its components and accumulate the sizes for each folder
        path_parts = path.split("/")
        top_level = path_parts[0]
        folder_sizes[top_level] += size

# Sort the folders by size in descending order
sorted_folders = sorted(folder_sizes.items(), key=lambda x: x[1], reverse=True)

# Print the sorted folders and their sizes
for folder, size in sorted_folders:
    print(f"{folder}: {size}")
