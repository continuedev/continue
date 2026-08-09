use std::collections::HashMap;
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};

pub fn local_find_gitignores(workspace_dir: &Path) -> io::Result<HashMap<PathBuf, String>> {
    let mut gitignores = HashMap::new();
    for entry in fs::read_dir(workspace_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            gitignores.extend(local_find_gitignores(&path)?);
        } else {
            match path.file_name().and_then(|name| name.to_str()) {
                Some(file_name) if file_name.ends_with(".gitignore") || file_name.ends_with(".continueignore") => {
                    let mut contents = String::new();
                    fs::File::open(&path)?.read_to_string(&mut contents)?;
                    gitignores.insert(path, contents);
                }
                _ => {}
            }
        }
    }
    Ok(gitignores)
}

fn main() -> io::Result<()> {
    let workspace_dir = Path::new("path/to/workspace");
    let gitignore_map = local_find_gitignores(workspace_dir)?;
    
    // Print out the result (optional)
    for (path, contents) in gitignore_map {
        println!("{}:\n{}", path.display(), contents);
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_local_find_gitignores() -> io::Result<()> {
        // Create a temporary directory for the test
        let temp_dir = tempdir()?;
        let temp_path = temp_dir.path();

        // Create some directories and .gitignore/.continueignore files
        let dir_structure = [
            ("dir1", Some(".gitignore"), "node_modules/"),
            ("dir2", Some(".continueignore"), "target/"),
            ("dir3", None, ""),
        ];

        for (dir, file, contents) in dir_structure.iter() {
            let dir_path = temp_path.join(dir);
            fs::create_dir(&dir_path)?;

            if let Some(file_name) = file {
                let file_path = dir_path.join(file_name);
                let mut file = File::create(file_path)?;
                writeln!(file, "{}", contents)?;
            }
        }

        // Call the function under test
        let gitignores = local_find_gitignores(temp_path)?;

        // Verify that the returned HashMap contains the correct paths and contents
        for (dir, file, contents) in dir_structure.iter() {
            if let Some(file_name) = file {
                let file_path = temp_path.join(dir).join(file_name);
                assert!(gitignores.contains_key(&file_path));
                assert_eq!(gitignores.get(&file_path).unwrap().trim(), *contents);
            }
        }

        // Cleanup the temporary directory automatically
        temp_dir.close()?;

        Ok(())
    }

    #[test]
    fn test_in_continue_repo() -> io::Result<()> {
        // Get the current directory
        let current_dir = std::env::current_dir()?;
        let parent_dir = current_dir.parent().unwrap();
        let gitignores = local_find_gitignores(&parent_dir)?;

        // Verify that the returned HashMap contains the correct paths and contents
        let top_level_gitignore = parent_dir.join(".gitignore");
        assert!(gitignores.contains_key(&top_level_gitignore));
        assert!(gitignores[&top_level_gitignore].contains(".tiktoken_cache"));

        Ok(())
    }
}
