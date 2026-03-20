/**
 * Build-time script that copies images from the docs directory to public/images/docs/.
 * Run via: npx tsx scripts/copy-doc-images.ts
 */
import fs from "fs";
import path from "path";

const DOCS_DIR = path.resolve(__dirname, "../../docs");
const OUT_DIR = path.resolve(__dirname, "../public/images/docs");

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".ico",
]);

function copyImagesRecursive(srcDir: string, destDir: string) {
  if (!fs.existsSync(srcDir)) return;

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyImagesRecursive(srcPath, destPath);
    } else if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  // Clean output directory
  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true });
  }

  // Copy all images from docs/images/ to public/images/docs/
  const imagesDir = path.join(DOCS_DIR, "images");
  if (fs.existsSync(imagesDir)) {
    copyImagesRecursive(imagesDir, OUT_DIR);
  }

  // Also copy any images scattered in other doc subdirectories
  // (for relative image references like ../some-dir/image.png)
  copyImagesRecursive(DOCS_DIR, OUT_DIR);

  // Count copied files
  let count = 0;
  function countFiles(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) countFiles(path.join(dir, entry.name));
      else count++;
    }
  }
  countFiles(OUT_DIR);

  console.log(`Copied ${count} images to public/images/docs/`);
}

main();
