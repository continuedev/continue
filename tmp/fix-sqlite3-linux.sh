#!/bin/bash
# Fix Continue extension on VS Code native WSL:
# replace Windows PE32 node_sqlite3.node with Linux ELF build.
#
# Usage: bash tmp/fix-sqlite3-linux.sh
set -e

NODE20_BIN=/home/app/miniconda3/envs/node20/bin
EXT_DIR=/home/app/.vscode/extensions/continue.continue-2.2.2/out
STAGE=/tmp/sqlite3-linux
SRC_CORE=/mnt/e/03-Sources/9.goku/continue/core

echo "=== 1. Prepare staging dir ==="
rm -rf "$STAGE"
mkdir -p "$STAGE"
# Minimal package.json (avoid copying full core package.json with workspace deps)
cat > "$STAGE/package.json" << 'EOF'
{
  "name": "sqlite3-linux-rebuild",
  "version": "1.0.0",
  "dependencies": {
    "sqlite3": "^5.1.7"
  }
}
EOF

echo "=== 2. npm install sqlite3 (build from source, Linux ELF) ==="
cd "$STAGE"
export PATH="$NODE20_BIN:$PATH"
echo "Using node: $(which node) $(node --version)"
echo "Using npm: $(which npm) $(npm --version)"
npm install --build-from-source 2>&1 | tail -5

echo "=== 3. Verify ELF binary ==="
SQLITE_NODE="$STAGE/node_modules/sqlite3/build/Release/node_sqlite3.node"
if [ ! -f "$SQLITE_NODE" ]; then
  echo "ERROR: $SQLITE_NODE not found"
  exit 1
fi
file "$SQLITE_NODE"
file "$SQLITE_NODE" | grep -q "ELF" || { echo "ERROR: not ELF!"; exit 1; }
echo "OK: Linux ELF binary"

echo "=== 4. Quick load test with node20 (ABI check) ==="
node -e "
const s = require('$SQLITE_NODE');
const db = new s.Database(':memory:');
db.run('CREATE TABLE t(x)', () => {
  db.run('INSERT INTO t VALUES (1)', () => {
    db.get('SELECT x FROM t', (e, r) => {
      console.log(e ? 'LOAD TEST FAIL: ' + e.message : 'LOAD TEST OK: ' + JSON.stringify(r));
      process.exit(e ? 1 : 0);
    });
  });
});
" || { echo "WARNING: load test failed with node20 ABI — VS Code Electron ABI may still differ, continue anyway"; }

echo "=== 5. Backup + replace in installed extension ==="
for f in "$EXT_DIR/Release/node_sqlite3.node" "$EXT_DIR/build/Release/node_sqlite3.node"; do
  if [ -f "$f" ]; then
    [ -f "$f.win.bak" ] || cp "$f" "$f.win.bak"
    cp -f "$SQLITE_NODE" "$f"
    echo "Replaced: $f"
  else
    echo "SKIP (not found): $f"
  fi
done

echo "=== 6. Verify ==="
for f in "$EXT_DIR/Release/node_sqlite3.node" "$EXT_DIR/build/Release/node_sqlite3.node"; do
  [ -f "$f" ] && file "$f"
done

echo ""
echo "=== Done! ==="
echo "Now: reload VS Code WSL window (Ctrl+Shift+P -> 'Developer: Reload Window')"
echo "Rollback: cp <file>.win.bak <file> (remove .win.bak suffix)"
