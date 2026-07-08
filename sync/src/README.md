# Codebase Indexing

This is a small Rust library for efficiently keeping a codebase index up to date.

### How it works

> Important definition: a _tag_ is a (workspace, branch, provider_id) pair that uniquely identifies an index. Since we use content-based addressing within the index, much of the data is shared for efficiency.

The output of the sync_results function is a list of 4 lists of tuples. Each tuple contains a file path and a hash of the file contents. The 4 lists are:

1. Compute: Files that need to be newly computed or updated
2. Delete: Files that need to be deleted from the index
3. Add label: Files that exist in the index but need to have a label added for a new tag
4. Remove label: Files that exist in the index but need to have a label removed

The labels help us filter when retrieving results from an index like Meilisearch or Chroma. All ids of the items in these indices are the hash of the file contents (possibly plus a chunk index at the end).

The first time, a Merkle tree of the codebase folder is constructed, ignoring any files in .gitignore or .continueignore. Every file found will be returned as needing to be computed added to the index.

Thereafter, the following steps are performed:

1. Load the previously computed merkle tree for the tag
2. Compute the current merkle tree of the codebase
3. Update the .last_sync file with current timestamp
4. Save the new tree to disk
5. Compute the diff of the trees, which tells you which files have been a) added or b) removed
6. For each file added:
   - If in the global cache, append it to `add_label`
   - Otherwise, append it to `compute`
7. For each file removed:
   - If in the global cache, but only in rev_tags for this tag, append it to `delete`
   - If in global cache for more than this tag, append it to `remove_label`
   - Otherwise, ignore. This should never happen.
8. Return (compute, delete, add_label, remove_label)

### Files created

Several files are stored and updated on disk in the ~/.continue/index folder to keep track of indexed files:

- `~/.continue/index/tags/<dir>/<branch>/<provider_id>/merkle_tree` - the last computed Merkle tree of the codebase for a given tag
- `~/.continue/index/tags/<dir>/<branch>/<provider_id>/.last_sync` - the last time the tag was synced
- The index cache contains a list of hashes that have already been computed both in general and per tag. These are always kept in sync.
  - `~/.continue/index/.index_cache` - contains the global cache (flat file of hashes)
  - `~/.continue/index/tags/<dir>/<branch>/<provider_id>/.index_cache` - contains the tag-specific cache (flat file of hashes)
  - `~/.continue/index/rev_tags` - contains a mapping from hash to tags that the hash is currently indexed for. This is a directory of files, where each file is prefixed with the first 2 characters of the hash. The file is a JSON mapping from hash to list of tags.

### Files

- `lib.rs` contains just the top-level function that is called by the Python bindings
- `sync/merkle.rs` contains the Merkle tree implementation (for building and comparing trees)
- `sync/mod.rs` contains the main sync logic, which handles maintenance of the on-disk database of which hashes are included in which tags

### Current limitations:

- Only handles local files, so is not currently being used in situations where the Continue server is on a different machine from the IDE or the workspace (Remote SSH, WSL, or a Continue server being run for a team).
- Currently not using stat to check for recent changes to files, is instaed re-calculating the entire Merkle tree on every IDE reload. This is fine for now since it only takes 0.2 seconds on the Continue codebase, but is a quick improvement we can make later.
