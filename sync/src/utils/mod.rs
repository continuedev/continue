use std::fs::{self, File};
use std::io::Write;
use tempfile::tempdir;

#[derive(Default)]
pub struct TempDirBuilder {
    files: Vec<(String, String)>,
}

impl TempDirBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(&mut self, path: &str, content: &str) -> &mut Self {
        self.files.push((path.to_string(), content.to_string()));
        self
    }

    pub fn create(&self) -> tempfile::TempDir {
        let temp_dir = tempdir().expect("Failed to create temp dir");

        for (path, content) in &self.files {
            let file_path = temp_dir.path().join(path);
            if let Some(dir) = file_path.parent() {
                fs::create_dir_all(dir).expect("Failed to create directory");
            }
            let mut file = File::create(&file_path).expect("Failed to create test file");
            writeln!(file, "{content}").expect("Failed to write to test file");
        }

        temp_dir
    }
}
