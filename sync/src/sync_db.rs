use crate::db::{add_tag, create_database, remove_chunks_for_hash, remove_tag};
use crate::sync;

pub fn sync_db(tag: &sync::Tag) -> Vec<(String, String)> {
    create_database();

    let results = sync::sync(tag).unwrap();

    // Send to IDE Extension to compute embeddings
    let compute = results.0;

    // Delete chunks
    for (_, hash) in results.1 {
        remove_chunks_for_hash(hash);
    }

    // Add tag from chunks
    for (_, hash) in results.2 {
        add_tag(hash, tag.to_string());
    }

    // Remove tag from chunk_rows
    for (_, hash) in results.3 {
        remove_tag(hash, tag.to_string());
    }

    return compute;
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_nothing_fails() {
        let tag = &sync::Tag {
            dir: Path::new("../extensions/vscode"),
            branch: "main",
            provider_id: "test",
        };
        sync_db(tag);
    }
}
