import ignore from "ignore";

export const DEFAULT_IGNORE_FILETYPES = [
  "*.DS_Store",
  "*-lock.json",
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
  "*.dmg",
  "*.tgz",
  "*.rar",
  "*.7z",
  "*.exe",
  "*.dll",
  "*.obj",
  "*.o",
  "*.o.d",
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
  "*.mp4",
  "*.mkv",
  "*.mkv",
  "*.webm",
  "*.jar",
  "*.onnx",
  "*.parquet",
  "*.pqt",
  "*.wav",
  "*.webp",
  "*.db",
  "*.sqlite",
  "*.wasm",
  "*.plist",
  "*.profraw",
  "*.gcda",
  "*.gcno",
  "go.sum",
  "*.env",
  "*.gitignore",
  "*.gitkeep",
  "*.continueignore",
  "config.json",
  "*.csv",
  // "*.prompt", // can be incredibly confusing for the LLM to have another set of instructions injected into the prompt
];

export const defaultIgnoreFile = ignore().add(DEFAULT_IGNORE_FILETYPES);
export const DEFAULT_IGNORE_DIRS = [
  ".git/",
  ".svn/",
  ".vscode/",
  ".idea/",
  ".vs/",
  "venv/",
  ".venv/",
  "env/",
  ".env/",
  "node_modules/",
  "dist/",
  "build/",
  "target/",
  "out/",
  "bin/",
  ".pytest_cache/",
  ".vscode-test/",
  ".continue/",
  "__pycache__/",
  "site-packages/",
  ".gradle/",
  ".cache/",
  "gems/",
  "vendor/",
];

export const defaultIgnoreDir = ignore().add(DEFAULT_IGNORE_DIRS);

export const DEFAULT_IGNORE =
  DEFAULT_IGNORE_FILETYPES.join("\n") + "\n" + DEFAULT_IGNORE_DIRS.join("\n");

export function gitIgArrayFromFile(file: string) {
  return file
    .split(/\r?\n/) // Split on new line
    .map((l) => l.trim()) // Remove whitespace
    .filter((l) => !/^#|^$/.test(l)); // Remove empty lines
}
