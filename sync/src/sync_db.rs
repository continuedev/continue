use std::path::Path;

use crate::db::{add_tag, create_database, remove_chunks_for_hash, remove_tag};
use crate::sync;

pub fn sync_db(dir: &Path, branch: String, tag: String) -> Vec<(String, String)> {
    create_database();

    let results = sync::sync(dir, Some(&branch)).unwrap();

    // Send to IDE Extension to compute embeddings
    let compute = results.0;

    // Delete chunks
    for (_, hash) in results.1 {
        remove_chunks_for_hash(hash);
    }

    // Add tag from chunks
    for (_, hash) in results.2 {
        add_tag(hash, tag.clone());
    }

    // Remove tag from chunk_rows
    for (_, hash) in results.3 {
        remove_tag(hash, tag.clone());
    }

    return compute;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nothing_fails() {
        sync_db(
            Path::new("../extensions/vscode"),
            "main".to_string(),
            "test::main".to_string(),
        );
    }
}
