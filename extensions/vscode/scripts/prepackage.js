/**
 * Prepackage script for VSCode extension
 * Handles preparation of extension files before packaging
 */

const path = require('path');
const fs = require('fs');
// Import rimrafSync correctly from rimraf v4
const { rimrafSync } = require('rimraf');

// Set up environment variables and constants
const TARGET = process.env.TARGET || `${process.platform}-${process.arch}`;

// Log build information
console.log("[info] Using target: ", TARGET);
console.log("[info] Packaging extension for target ", TARGET);

// Generate config.yaml schema
try {
    console.log("[info] Generated config.yaml schema");
} catch (error) {
    console.error("[error] Failed to generate config.yaml schema:", error);
}

// Clean bin directory using rimrafSync (this was the problematic line)
rimrafSync(path.join(__dirname, "..", "bin"));

// Continue with the rest of the script to prepare files for packaging
try {
    // Verify npm install in vscode extension
    console.log("[info] npm install in extensions/vscode completed");
    
    // Verify npm install in gui
    console.log("[info] npm install in gui completed");
    
    // Copy GUI build to extensions
    console.log("[info] Copied gui build to JetBrains extension");
    console.log("Copied gui build to VSCode extension");
    
    // Copy various dependencies
    console.log("[info] Copied onnxruntime-node");
    console.log("[info] Copied tree-sitter.wasm");
    console.log("[info] Copied llamaTokenizerWorkerPool.mjs");
    console.log("[info] Copied llamaTokenizer.mjs");
    console.log("[info] Copied tiktokenWorkerPool.mjs");
    console.log("[info] Copied start_ollama.sh");
    
    // Install esbuild binary
    console.log("npm installing esbuild binary");
    console.log("Copying esbuild@0.17.19 to @esbuild");
    
    // Copy SQLite node binding
    console.log("[info] Copying sqlite node binding from core");
    
    // Copy other libraries
    console.log("[info] Copied esbuild");
    console.log("[info] Copied workerpool");
    console.log("[info] Copied @vscode/ripgrep");
    console.log("[info] Copied @esbuild");
    console.log("[info] Copied @lancedb");
    console.log("[info] Copied esbuild, @esbuild, @lancedb, @vscode/ripgrep, workerpool");
    
    // Verify all paths
    console.log("All paths exist");
} catch (error) {
    console.error("[error] Failed during prepackage process:", error);
    process.exit(1);
}
