mod merkle;
use homedir::get_my_home;
use ignore;
use merkle::{build_walk, compute_tree_for_dir, diff, hash_string, ObjectHash};
use std::{
    fs::{File, OpenOptions},
    io::{BufRead, BufReader, Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use self::merkle::{ObjDescription, Tree};

/// Stored in ~/.continue/index/.last_sync
fn get_last_sync_time() -> u64 {
    // TODO: Error handle here
    let home = get_my_home().unwrap().unwrap();
    let path = home.join(".continue/index/.last_sync");

    let mut file = File::open(path).unwrap();
    let mut contents = String::new();
    file.read_to_string(&mut contents).unwrap();

    let last_sync_time = contents.parse::<u64>().unwrap();
    return last_sync_time;
}

fn write_sync_time() {
    let home = get_my_home().unwrap().unwrap();
    let path = home.join(".continue/index/.last_sync");

    let mut file = File::create(path).unwrap();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    file.write_all(now.to_string().as_bytes()).unwrap();
}

/// Use stat to find files since last sync time
pub fn get_modified_files(dir: &Path) -> Vec<PathBuf> {
    let last_sync_time = get_last_sync_time();
    let mut modified_files = Vec::new();
    for entry in build_walk(dir) {
        let entry = entry.unwrap();
        let path = entry.path();
        let metadata = path.metadata().unwrap();
        let modified = metadata.modified().unwrap();

        if modified.duration_since(UNIX_EPOCH).unwrap().as_secs() > last_sync_time {
            modified_files.push(path.to_path_buf().clone());
        }
    }

    return modified_files;
}

// Merkle trees are unique to directories, even if nested, but .index_cache is shared between all

fn remove_seps_from_path(dir: &Path) -> String {
    let mut path = String::new();
    for component in dir.components() {
        path.push_str(component.as_os_str().to_str().unwrap());
    }

    // Remove leading slash
    if path.starts_with("/") || path.starts_with("\\") {
        path.remove(0);
    }
    return path;
}

fn tree_path_for_dir_branch(dir: &Path, branch: Option<&str>) -> PathBuf {
    let mut path = get_my_home().unwrap().unwrap();
    path.push(".continue/index");
    path.push(remove_seps_from_path(dir));
    if let Some(branch) = branch {
        path.push(branch);
    } else {
        path.push("main");
    }
    path.push("merkle_tree");
    return path;
}

struct DiskSet {
    file: File,
}

const ITEM_SIZE: usize = 20;

impl DiskSet {
    pub fn new(path: &str) -> DiskSet {
        let path = Path::new(path);
        if !path.exists() {
            File::create(path).unwrap();
        }

        DiskSet {
            file: OpenOptions::new()
                .read(true)
                .write(true)
                .open(path)
                .unwrap(),
        }
    }

    pub fn contains(&mut self, item: &[u8; ITEM_SIZE]) -> bool {
        self.file.seek(SeekFrom::Start(0)).unwrap();
        let mut buffer = [0; ITEM_SIZE];
        while self.file.read_exact(&mut buffer).is_ok() {
            if &buffer == item {
                return true;
            }
        }
        false
    }

    pub fn add(&mut self, item: &[u8; ITEM_SIZE]) {
        if self.contains(item) {
            return;
        }

        self.file.write_all(item).unwrap();
        self.file.flush().unwrap();
    }

    pub fn remove(&mut self, item: &[u8; ITEM_SIZE]) {
        self.file.seek(SeekFrom::Start(0)).unwrap();
        let mut buffer = [0; ITEM_SIZE];
        let mut pos = 0;
        let mut found = false;
        while self.file.read_exact(&mut buffer).is_ok() {
            if &buffer == item {
                found = true;
                break;
            }
            pos = self.file.stream_position().unwrap() as usize;
        }

        if found {
            // Calculate the position of the last item
            let len = self.file.metadata().unwrap().len() as usize;
            let last_item_pos = len - ITEM_SIZE;

            // Move the last item in the file to the position of the item we want to remove
            self.file
                .seek(SeekFrom::Start(last_item_pos as u64))
                .unwrap();
            self.file.read_exact(&mut buffer).unwrap();
            self.file.seek(SeekFrom::Start(pos as u64)).unwrap();
            self.file.write_all(&buffer).unwrap();

            // Truncate the file at the position of the last item
            self.file.set_len(last_item_pos as u64).unwrap();
        }
    }
}

pub fn sync(
    dir: &Path,
    branch: Option<&str>,
) -> Result<
    (
        Vec<(String, String)>,
        Vec<(String, String)>,
        Vec<(String, String)>,
        Vec<(String, String)>,
    ),
    Box<dyn std::error::Error>,
> {
    let tree_path = tree_path_for_dir_branch(dir, branch);
    let old_tree: Tree = match Tree::load(&tree_path) {
        Ok(tree) => tree,
        Err(_) => Tree::empty(),
    };

    // Calculate and save new tree
    // TODO: Use modified files to speed up calculation
    // let modified_files = get_modified_files(dir);
    let new_tree = compute_tree_for_dir(dir, None)?;

    // Update last sync time
    write_sync_time();

    // Save new tree
    new_tree.persist(&tree_path);

    // Compute diff
    let (add, remove) = diff(&old_tree, &new_tree);

    // Compute the four action types: compute, remove, add tag, remove tag,
    // transform into desired format: [(path, hash), ...],
    // and update .index_cache
    let index_cache_path = get_my_home()
        .unwrap()
        .unwrap()
        .join(".continue/index/.index_cache");
    let mut disk_set = DiskSet::new(index_cache_path.to_str().unwrap());

    let mut compute: Vec<(String, String)> = Vec::new();
    let mut delete: Vec<(String, String)> = Vec::new();
    let mut add_label: Vec<(String, String)> = Vec::new();
    let mut remove_label: Vec<(String, String)> = Vec::new();

    for item in add {
        if !item.is_blob {
            continue;
        }
        let path = item.path.as_str().to_string();
        let hash = hash_string(item.hash);
        if disk_set.contains(&item.hash) {
            add_label.push((path, hash));
        } else {
            compute.push((path, hash));
        }
    }

    for item in remove {
        if !item.is_blob {
            continue;
        }
        if disk_set.contains(&item.hash) {
            let path = item.path.as_str().to_string();
            let hash = hash_string(item.hash);
        } else {
            // Should never happen
        }
    }

    return Ok((compute, delete, add_label, remove_label));
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::remove_file;

    #[test]
    fn test_disk_set() {
        let path = "testfile";
        let mut disk_set = DiskSet::new(path);

        let item1: ObjectHash = [1; ITEM_SIZE];
        let item2: ObjectHash = [20; ITEM_SIZE];
        let item3: ObjectHash = [30; ITEM_SIZE];

        // Test add and contains
        disk_set.add(&item1);
        disk_set.add(&item2);
        assert!(disk_set.contains(&item1));
        assert!(disk_set.contains(&item2));

        // Test the exact contents of the file
        disk_set.file.seek(SeekFrom::Start(0)).unwrap();
        let mut buffer = [0; ITEM_SIZE];
        disk_set.file.read_exact(&mut buffer).unwrap();
        assert_eq!(buffer, item1);
        disk_set.file.read_exact(&mut buffer).unwrap();
        assert_eq!(buffer, item2);

        // Test remove
        disk_set.remove(&item1);
        assert!(!disk_set.contains(&item1));
        assert!(disk_set.contains(&item2));

        // Test one more add
        disk_set.add(&item3);
        assert!(disk_set.contains(&item3));

        // Test the length of the file
        disk_set.file.seek(SeekFrom::Start(0)).unwrap();
        let mut buffer = [0; ITEM_SIZE];
        let mut count = 0;
        while disk_set.file.read_exact(&mut buffer).is_ok() {
            count += 1;
        }
        assert_eq!(count, 2);

        // Clean up
        remove_file(path).unwrap();
    }

    #[test]
    fn test_sync() {
        let ti = std::time::Instant::now();
        let results = sync(
            Path::new("/Users/natesesti/Desktop/continue"),
            Some("nate/pyO3"),
        );
        println!("Sync took {:?}", ti.elapsed());
        // Vast majority (90+%) of this time is spent in compute_tree_for_dir
    }

    #[test]
    fn test_double_sync() {
        let ti = std::time::Instant::now();
        let results = sync(
            Path::new("/Users/natesesti/Desktop/continue"),
            Some("nate/pyO3"),
        )
        .expect("Sync failed.");
        println!("First sync took {:?}", ti.elapsed());
        assert!(results.0.len() > 0);
        assert!(results.1.len() > 0);

        let ti = std::time::Instant::now();
        let results = sync(
            Path::new("/Users/natesesti/Desktop/continue"),
            Some("nate/pyO3"),
        )
        .expect("Sync failed");
        println!("Second sync took {:?}", ti.elapsed());
        assert_eq!(results.0.len(), 0);
        assert_eq!(results.1.len(), 0);
    }
}
