use homedir::get_my_home;
use ignore::{Walk, WalkBuilder};
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::{
    io::{Read, Result, Write},
    path::{Path, PathBuf},
};

pub type ObjectHash = [u8; 20];

pub fn hash_string(hash: ObjectHash) -> String {
    hash.iter().fold(String::new(), |mut output, byte| {
        output.push_str(&format!("{byte:02x}"));
        output
    })
}

#[derive(Clone, Default)]
pub struct Tree {
    parent: Option<ObjectHash>,
    children: Vec<Object>,
    hash: ObjectHash,
    path: String,
}

#[derive(Serialize, Deserialize)]
struct SerializeableNode {
    parent: Option<ObjectHash>,

    /// Blobs would have no children
    children: Option<Vec<ObjectHash>>,
    hash: ObjectHash,
    path: String,
}

#[derive(Clone)]
struct Blob {
    parent: Option<ObjectHash>,
    hash: ObjectHash,
    path: String,
}

#[derive(Clone)]
enum Object {
    Tree(Tree),
    Blob(Blob),
}

impl From<Tree> for Object {
    fn from(tree: Tree) -> Self {
        Self::Tree(tree)
    }
}

impl From<Blob> for Object {
    fn from(blob: Blob) -> Self {
        Self::Blob(blob)
    }
}

pub struct ObjDescription {
    pub hash: ObjectHash,
    pub path: String,
    pub is_blob: bool,
}

impl Object {
    fn hash(&self) -> ObjectHash {
        match self {
            Self::Tree(tree) => tree.hash,
            Self::Blob(blob) => blob.hash,
        }
    }

    fn path(&self) -> &String {
        match self {
            Self::Tree(tree) => &tree.path,
            Self::Blob(blob) => &blob.path,
        }
    }

    fn json_for_obj(&self) -> String {
        match self {
            Self::Tree(tree) => tree.json_for_obj(),
            Self::Blob(blob) => blob.json_for_obj(),
        }
    }

    fn descr(&self) -> ObjDescription {
        return ObjDescription {
            hash: self.hash(),
            path: self.path().clone(),
            is_blob: matches!(self, Self::Blob(_)),
        };
    }

    /// Return a tuple of (paths to add, paths to remove)
    fn diff(&self, new_obj: &Self) -> (Vec<ObjDescription>, Vec<ObjDescription>) {
        let mut add: Vec<ObjDescription> = Vec::new();
        let mut remove: Vec<ObjDescription> = Vec::new();

        if self.hash() == new_obj.hash() {
            return (add, remove);
        }

        match (self, new_obj) {
            (Self::Tree(old_tree), Self::Tree(new_tree)) => {
                // This is where you recurse like below
                let (child_add, child_remove) = old_tree.diff_children(new_tree);
                add.push(new_tree.descr());
                remove.push(old_tree.descr());
                add.extend(child_add);
                remove.extend(child_remove);
            }
            (Self::Blob(old_blob), Self::Blob(new_blob)) => {
                add.push(new_blob.descr());
                remove.push(old_blob.descr());
            }
            (Self::Blob(old_blob), Self::Tree(new_tree)) => {
                // Remove blob, add entire new tree
                remove.push(old_blob.descr());
                add.extend(new_tree.all_obj_descriptions());
            }
            (Self::Tree(old_tree), Self::Blob(new_blob)) => {
                // Remove entire old tree, add blob
                remove.extend(old_tree.all_obj_descriptions());
                add.push(new_blob.descr());
            }
        }

        (add, remove)
    }
}

pub fn diff(old_tree: &Tree, new_tree: &Tree) -> (Vec<ObjDescription>, Vec<ObjDescription>) {
    let mut add: Vec<ObjDescription> = Vec::new();
    let mut remove: Vec<ObjDescription> = Vec::new();

    if old_tree.hash == new_tree.hash {
        return (add, remove);
    }

    let (child_add, child_remove) = old_tree.diff_children(new_tree);

    add.push(new_tree.descr());
    remove.push(old_tree.descr());
    add.extend(child_add);
    remove.extend(child_remove);

    (add, remove)
}

impl Blob {
    fn json_for_obj(&self) -> String {
        let node = SerializeableNode {
            parent: self.parent,
            children: None,
            hash: self.hash,
            path: self.path.clone(),
        };

        let mut json = serde_json::to_string(&node).unwrap();
        json.push('\n');
        json
    }

    fn descr(&self) -> ObjDescription {
        ObjDescription {
            hash: self.hash,
            path: self.path.clone(),
            is_blob: true,
        }
    }
}

// enum DiffType {
//     Add,
//     Update,
//     Remove,
// }

impl Tree {
    fn descr(&self) -> ObjDescription {
        ObjDescription {
            hash: self.hash,
            path: self.path.clone(),
            is_blob: false,
        }
    }

    fn json_for_node(&self) -> String {
        let node = SerializeableNode {
            parent: self.parent,
            children: Some(self.children.iter().map(Object::hash).collect()),
            hash: self.hash,
            path: self.path.clone(),
        };

        let mut json = serde_json::to_string(&node).unwrap();
        json.push('\n');
        json
    }

    fn json_for_obj(&self) -> String {
        let mut result = String::new();
        result.push_str(&self.json_for_node());

        for child in &self.children {
            result.push_str(&child.json_for_obj());
        }

        result
    }

    fn obj_from_jsonl(lines: &mut std::str::Lines, first_line: Option<SerializeableNode>) -> Self {
        let root_node =
            first_line.unwrap_or_else(|| serde_json::from_str(lines.next().unwrap()).unwrap());

        let children = root_node
            .children
            .unwrap()
            .into_iter()
            .map(|_child_hash| {
                let child_jsonl = lines.next().unwrap();
                let child_node: SerializeableNode = serde_json::from_str(child_jsonl).unwrap();
                if child_node.children.is_some() {
                    Self::obj_from_jsonl(lines, Some(child_node)).into()
                } else {
                    Blob {
                        parent: child_node.parent,
                        hash: child_node.hash,
                        path: child_node.path,
                    }
                    .into()
                }
            })
            .collect();

        Self {
            parent: root_node.parent,
            children,
            hash: root_node.hash,
            path: root_node.path,
        }
    }

    /// Persist the tree to disk as JSONL
    pub fn persist(&self, filepath: &Path) {
        if let Some(dir) = filepath.parent() {
            std::fs::create_dir_all(dir)
                .unwrap_or_else(|_| panic!("Failed to create dir {}", dir.display()));
        }
        let mut file = std::fs::File::create(filepath).unwrap();
        file.write_all(self.json_for_obj().as_bytes()).unwrap();
    }

    /// Load the tree from JSONL file
    pub fn load(filepath: &Path) -> Result<Self> {
        let mut file = std::fs::File::open(filepath)?;
        let mut contents = String::new();
        file.read_to_string(&mut contents)?;
        let mut lines = contents.lines();
        Ok(Self::obj_from_jsonl(&mut lines, None))
    }

    // pub fn empty() -> Self {
    //     Self::default()
    // }

    fn set_childrens_parent(&mut self) {
        for child in &mut self.children {
            match child {
                Object::Tree(tree) => {
                    tree.parent = Some(self.hash);
                    tree.set_childrens_parent();
                }
                Object::Blob(blob) => {
                    blob.parent = Some(self.hash);
                }
            }
        }
    }

    fn walk(&self, callback: &mut dyn FnMut(&Object)) {
        callback(&Object::Tree(self.clone()));
        for child in &self.children {
            match child {
                Object::Tree(tree) => tree.walk(callback),
                Object::Blob(blob) => callback(&Object::Blob(blob.clone())),
            }
        }
    }

    fn all_obj_descriptions(&self) -> Vec<ObjDescription> {
        let mut result = Vec::new();
        self.walk(&mut |obj| result.push(obj.descr()));
        result
    }

    /// Return a list of paths that have changed and the type of change (0 = add, 1 = update, 2 = remove)
    /// other is considered the "new" tree
    fn diff_children(&self, new_tree: &Self) -> (Vec<ObjDescription>, Vec<ObjDescription>) {
        let mut add = Vec::new();
        let mut remove = Vec::new();

        // There are situations where the names of two folders could be swapped and then each slightly changed
        // where you would need some heuristics to avoid throwing them out...but...don't worry for now. Just match by path

        let mut old_path_to_object: std::collections::HashMap<String, &Object> = self
            .children
            .iter()
            .map(|child| (child.path().clone(), child))
            .collect();

        for child in &new_tree.children {
            if let Some(old_child) = old_path_to_object.remove(child.path()) {
                // If the same path name exists in old children
                let (child_add, child_remove) = old_child.diff(child);
                add.extend(child_add);
                remove.extend(child_remove);
            } else {
                // Name didn't exist before. Add all
                match child {
                    Object::Tree(tree) => {
                        add.extend(tree.all_obj_descriptions());
                    }
                    Object::Blob(blob) => {
                        add.push(blob.descr());
                    }
                }
            }
        }

        // Remove - along with all children
        for obj in old_path_to_object.values() {
            match obj {
                Object::Tree(tree) => tree.walk(&mut |_obj| {
                    remove.extend(tree.all_obj_descriptions());
                }),
                Object::Blob(_) => remove.push(obj.descr()),
            }
        }

        (add, remove)
    }
}

const GLOBAL_IGNORE_PATTERNS: &[&str] = &[
    "**/.DS_Store",
    "**/package-lock.json",
    "*.lock",
    "*.log",
    "*.ttf",
    "*.png",
    "*.jpg",
    "*.jpeg",
    "*.gif",
    "*.mp4",
    "*.svg",
    "*.ico",
    "*.pdf",
    "*.zip",
    "*.gz",
    "*.tar",
    "*.tgz",
    "*.rar",
    "*.7z",
    "*.exe",
    "*.dll",
    "*.obj",
    "*.o",
    "*.a",
    "*.lib",
    "*.so",
    "*.dylib",
    "*.ncb",
    "*.sdf",
    "*.woff",
    "*.woff2",
    "*.eot",
    "*.cur",
    "*.avi",
    "*.mpg",
    "*.mpeg",
    "*.mov",
    "*.mp3",
    "*.mkv",
    "*.webm",
    "*.jar",
    "*.onnx",
    "*.tmp",
    "*.swp",
    "*.bak",
    "*.dmp",
    "**/node_modules/",
    "**/.git",
    "*.class",
    "*.pyc",
    "*.pyo",
    "*.whl",
    "*.egg-info",
    "*.db",
    "*.sql",
    "*.sqlite",
    "*.sqlite3",
    "**/__pycache__/",
    "**/.pytest_cache/",
    "**/.env",
    "*.pem",
    "*.cert",
    "*.key",
    "*.csr",
    "**/.idea/",
    "**/.vscode/",
    "**/.history/",
    "*.sass-cache",
    "*.scssc",
    "*.parquet",
];

fn global_ignore_path() -> PathBuf {
    let mut path = get_my_home().unwrap().unwrap();
    path.push(".continue");
    path.push(".continueignore");
    path
}

fn create_global_ignore_file() -> PathBuf {
    // Because you have to pass a real filepath to the ignore crate, you can't just pass a string
    let path = global_ignore_path();

    if !path.exists() {
        let mut file = std::fs::File::create(path).unwrap();
        for pattern in GLOBAL_IGNORE_PATTERNS {
            file.write_all(pattern.as_bytes()).unwrap();
            file.write_all(b"\n").unwrap();
        }
    }

    global_ignore_path()
}

pub fn build_walk(dir: &Path) -> Walk {
    let path = create_global_ignore_file();
    // Make sure it sorts alphabetically by default
    let mut binding = WalkBuilder::new(dir);
    let builder = binding.add_custom_ignore_filename(".continueignore");

    builder.add_ignore(path);
    builder.build()
}

fn sha1_hash(content: &str) -> ObjectHash {
    let mut hasher = Sha1::new();
    hasher.update(content);
    hasher.finalize().into()
}

fn blob_hash(content: &str, file_ext: &str) -> ObjectHash {
    sha1_hash(&format!("blob {file_ext} {content}"))
}

fn create_blob(filepath: &Path, parent: Option<ObjectHash>) -> Result<Blob> {
    let content = std::fs::read_to_string(filepath)?;
    let hash = blob_hash(
        &content,
        filepath.extension().map_or("", |ext| ext.to_str().unwrap()),
    );
    Ok(Blob {
        parent,
        hash,
        path: filepath.to_str().unwrap().to_string(),
    })
}

fn tree_hash(children: impl IntoIterator<Item = ObjectHash>) -> ObjectHash {
    let mut hasher = Sha1::new();
    hasher.update(b"tree");

    // Note you're not just concatenating
    for child in children {
        hasher.update(child);
    }
    let result = hasher.finalize();
    let hash_bytes: [u8; 20] = result.into();
    hash_bytes
}

struct PreTree {
    children: Vec<Object>,
    path: String,
}

impl PreTree {
    fn finalize(&self) -> Tree {
        return Tree {
            parent: None,
            children: self.children.clone(),
            hash: tree_hash(self.children.iter().map(Object::hash)),
            path: self.path.clone(),
        };
    }
}

/// Compute merkle tree and all sub-objects
/// The last element in the vector is the root of the tree
pub fn compute_tree_for_dir(dir: &Path, _parent: Option<ObjectHash>) -> Result<Tree> {
    let mut walk = build_walk(dir);
    let root_entry = walk
        .next() // This is just "."
        .expect("Directory does not exist")
        .expect("Error parsing directory");

    // The last in the vector is the latest
    // The first in the stack will end up being the root
    let mut tree_stack: Vec<PreTree> = Vec::new();
    tree_stack.push(PreTree {
        children: Vec::new(),
        path: root_entry.path().to_str().unwrap().to_string(),
    });
    let mut current_dir = dir.to_path_buf();

    for entry in walk {
        let entry = entry.unwrap();
        let path = entry.path();
        let metadata = entry.metadata().unwrap();

        // Check whether current_dir is complete
        while !path.starts_with(current_dir.as_path()) {
            // We've moved up by (at least) one directory
            // We need to pop the current directory off the stack
            // and create a tree object for it
            let partial_tree = tree_stack.pop().unwrap();
            tree_stack
                .last_mut()
                .unwrap()
                .children
                .push(Object::Tree(partial_tree.finalize()));

            // Update current_dir
            current_dir = current_dir.parent().unwrap().to_path_buf();
        }

        if metadata.is_dir() {
            let partial_tree = PreTree {
                children: Vec::new(),
                path: path.to_str().unwrap().to_string(),
            };
            tree_stack.push(partial_tree);
            current_dir = path.to_owned();
        } else {
            match create_blob(path, None) {
                Ok(blob) => {
                    tree_stack
                        .last_mut()
                        .unwrap()
                        .children
                        .push(Object::Blob(blob));
                }
                Err(_err) => {
                    // Not UTF-8 formatted. Binary file. Ignore.
                }
            }
        }
    }

    // Collapse the stack upward
    while tree_stack.len() > 1 {
        let partial_tree = tree_stack.pop().unwrap();
        tree_stack
            .last_mut()
            .unwrap()
            .children
            .push(Object::Tree(partial_tree.finalize()));
    }

    assert!(
        tree_stack.len() == 1,
        "Tree stack should only have exactly one element"
    );

    // Convert to Tree
    let mut root_tree = tree_stack.pop().unwrap().finalize();

    // Go through and update the parent of each child
    root_tree.set_childrens_parent();

    Ok(root_tree)
}

// Tests
#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::TempDirBuilder;
    use std::fs::{self};

    #[test]
    fn test_compute_tree_for_temp_dir() {
        let temp_dir = TempDirBuilder::new()
            .add("dir1/file1.txt", "Hello, world!")
            .add("dir1/file2.txt", "Hello, world!")
            .add("dir2/file3.txt", "Hello, world!")
            .add("dir2/subdir/continue.py", "[continue for i in range(10)]")
            .add("__init__.py", "a = 5")
            .create();

        let tree = compute_tree_for_dir(temp_dir.path(), None).expect("Failed to compute tree");

        // Check that every node but the root has a parent, matching that parent's hash
        tree.walk(&mut |obj| match obj {
            Object::Tree(tree) => {
                for child in &tree.children {
                    match child {
                        Object::Tree(child_tree) => {
                            assert_eq!(child_tree.parent, Some(tree.hash));
                        }
                        Object::Blob(child_blob) => {
                            assert_eq!(child_blob.parent, Some(tree.hash));
                        }
                    }
                }
            }
            Object::Blob(_) => {}
        });

        // TODO: If a folder was removed, and another added, but they have the same hash, you should then assume it was renamed

        // Make sure hash was calculated in same way as always
        assert_eq!(
            hash_string(tree.hash),
            "cb6bf3834fdc9c356a23fca2cb6f6d7a571474c4"
        );

        let temp_dir2 = TempDirBuilder::new()
            .add("dir1/file1.txt", "Hello, world!")
            .add("dir1/file2.txt", "Hello, world!")
            .add("dir2/file3.txt", "Hello, world!")
            .add("dir2/subdir/continue.py", "[continue for i in range(11)]") // Difference here
            .add("__init__.py", "a = 5")
            .create();

        let tree2 = compute_tree_for_dir(temp_dir2.path(), None).expect("Failed to compute tree");

        // Make sure hash was calculated in same way as always

        // Check that certain nodes have different hashes
        assert_ne!(tree.hash, tree2.hash);
        assert_ne!(tree.children[0].hash(), tree2.children[0].hash());
        assert_eq!(tree.children[1].hash(), tree2.children[1].hash());
        assert_eq!(tree.children[2].hash(), tree2.children[2].hash());

        // Make a small change and recompute the tree
        let path = temp_dir.path().join("dir2/subdir/continue.py");
        fs::write(path, "[continue for i in range(11)]").expect("Failed to write to file");
        let tree_prime =
            compute_tree_for_dir(temp_dir.path(), None).expect("Failed to compute tree");

        // All nodes up the tree from dir2/subdir/continue.py should be marked as changed
        let (add, remove) = diff(&tree, &tree_prime);
        assert_eq!(add.len(), 4);
        assert_eq!(remove.len(), 4);

        // Try adding a file at the root level
        let path = temp_dir.path().join("new_file.txt");
        fs::write(path, "42").expect("Failed to write to file");
        let tree_prime_prime =
            compute_tree_for_dir(temp_dir.path(), None).expect("Failed to compute tree");

        // Compare original and ''
        let (add, remove) = diff(&tree, &tree_prime_prime);
        assert_eq!(add.len(), 5);
        assert_eq!(remove.len(), 4);

        // Compare ' and ''
        let (add, remove) = diff(&tree_prime, &tree_prime_prime);
        assert_eq!(add.len(), 2);
        assert_eq!(remove.len(), 1);

        temp_dir.close().expect("Failed to clean up temp dir");
        temp_dir2.close().expect("Failed to clean up temp dir");
    }
}
