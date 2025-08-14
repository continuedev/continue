const { annotateDiff } = require('./annotate-diff.js');

describe('annotateDiff', () => {
  test('single file, single hunk', () => {
    const diff = `diff --git a/file.js b/file.js
index abc123..def456 100644
--- a/file.js
+++ b/file.js
@@ -1,3 +1,4 @@
 line1
 line2
+added line
 line3`;

    const result = annotateDiff(diff);
    expect(result).toContain('[POS:1]  line1');
    expect(result).toContain('[POS:2]  line2');
    expect(result).toContain('[POS:3] +added line');
    expect(result).toContain('[POS:4]  line3');
  });

  test('single file, multiple hunks with +1 between', () => {
    const diff = `diff --git a/file.js b/file.js
index abc123..def456 100644
--- a/file.js
+++ b/file.js
@@ -1,3 +1,3 @@
 line1
-old line
+new line
 line3
@@ -10,3 +10,3 @@
 line10
-old line 11
+new line 11
 line12`;

    const result = annotateDiff(diff);
    
    // First hunk
    expect(result).toContain('[POS:1]  line1');
    expect(result).toContain('[POS:2] -old line');
    expect(result).toContain('[POS:3] +new line');
    expect(result).toContain('[POS:4]  line3');
    
    // Second hunk (should start at 6, because 4 lines + 1 for between hunks)
    expect(result).toContain('[POS:6]  line10');
    expect(result).toContain('[POS:7] -old line 11');
    expect(result).toContain('[POS:8] +new line 11');
    expect(result).toContain('[POS:9]  line12');
  });

  test('multiple files reset position counter', () => {
    const diff = `diff --git a/file1.js b/file1.js
index abc123..def456 100644
--- a/file1.js
+++ b/file1.js
@@ -1,2 +1,2 @@
 line1
-old
+new
diff --git a/file2.js b/file2.js
index abc123..def456 100644
--- a/file2.js
+++ b/file2.js
@@ -1,2 +1,2 @@
 first
-old2
+new2`;

    const result = annotateDiff(diff);
    
    // File 1
    expect(result).toContain('[POS:1]  line1');
    expect(result).toContain('[POS:2] -old');
    expect(result).toContain('[POS:3] +new');
    
    // File 2 - positions should reset
    const file2Section = result.split('diff --git a/file2.js')[1];
    expect(file2Section).toContain('[POS:1]  first');
    expect(file2Section).toContain('[POS:2] -old2');
    expect(file2Section).toContain('[POS:3] +new2');
  });

  test('handles new file', () => {
    const diff = `diff --git a/newfile.js b/newfile.js
new file mode 100644
index 0000000..abc123
--- /dev/null
+++ b/newfile.js
@@ -0,0 +1,3 @@
+line1
+line2
+line3`;

    const result = annotateDiff(diff);
    expect(result).toContain('new file mode 100644');
    expect(result).toContain('[POS:1] +line1');
    expect(result).toContain('[POS:2] +line2');
    expect(result).toContain('[POS:3] +line3');
  });

  test('handles deleted file', () => {
    const diff = `diff --git a/deleted.js b/deleted.js
deleted file mode 100644
index abc123..0000000
--- a/deleted.js
+++ /dev/null
@@ -1,3 +0,0 @@
-line1
-line2
-line3`;

    const result = annotateDiff(diff);
    expect(result).toContain('deleted file mode 100644');
    expect(result).toContain('[POS:1] -line1');
    expect(result).toContain('[POS:2] -line2');
    expect(result).toContain('[POS:3] -line3');
  });

  test('handles renamed file with changes', () => {
    const diff = `diff --git a/old-name.js b/new-name.js
similarity index 95%
rename from old-name.js
rename to new-name.js
index abc123..def456 100644
--- a/old-name.js
+++ b/new-name.js
@@ -1,3 +1,3 @@
 line1
-old line
+new line
 line3`;

    const result = annotateDiff(diff);
    expect(result).toContain('rename from old-name.js');
    expect(result).toContain('rename to new-name.js');
    expect(result).toContain('[POS:1]  line1');
    expect(result).toContain('[POS:2] -old line');
    expect(result).toContain('[POS:3] +new line');
  });

  test('handles no newline at end of file', () => {
    const diff = `diff --git a/file.js b/file.js
index abc123..def456 100644
--- a/file.js
+++ b/file.js
@@ -1,2 +1,2 @@
 line1
-old line
\\ No newline at end of file
+new line
\\ No newline at end of file`;

    const result = annotateDiff(diff);
    expect(result).toContain('[POS:1]  line1');
    expect(result).toContain('[POS:2] -old line');
    expect(result).toContain('\\ No newline at end of file');
    expect(result).toContain('[POS:3] +new line');
    expect(result).toContain('\\ No newline at end of file');
    // No newline markers should not get position numbers
    expect(result).not.toContain('[POS:4] \\');
  });

  test('handles file mode changes', () => {
    const diff = `diff --git a/script.sh b/script.sh
old mode 100644
new mode 100755
index abc123..def456 100644
--- a/script.sh
+++ b/script.sh
@@ -1,2 +1,2 @@
 #!/bin/bash
-echo "old"
+echo "new"`;

    const result = annotateDiff(diff);
    expect(result).toContain('old mode 100644');
    expect(result).toContain('new mode 100755');
    expect(result).toContain('[POS:1]  #!/bin/bash');
    expect(result).toContain('[POS:2] -echo "old"');
    expect(result).toContain('[POS:3] +echo "new"');
  });

  test('empty diff returns empty', () => {
    const diff = '';
    const result = annotateDiff(diff);
    expect(result).toBe('');
  });

  test('complex multi-file, multi-hunk diff', () => {
    const diff = `diff --git a/src/app.js b/src/app.js
index abc123..def456 100644
--- a/src/app.js
+++ b/src/app.js
@@ -10,4 +10,5 @@ function example() {
   console.log("start");
   const x = 1;
-  const y = 2;
+  const y = 3;
+  const z = 4;
   return x + y;
@@ -20,3 +21,4 @@ function another() {
   let a = 1;
   let b = 2;
+  let c = 3;
   return a + b;
diff --git a/src/util.js b/src/util.js
index 111111..222222 100644
--- a/src/util.js
+++ b/src/util.js
@@ -1,2 +1,3 @@
+import fs from 'fs';
 export function util() {
   return true;`;

    const result = annotateDiff(diff);
    
    // src/app.js - first hunk
    expect(result).toContain('[POS:1]    console.log("start");');
    expect(result).toContain('[POS:2]    const x = 1;');
    expect(result).toContain('[POS:3] -  const y = 2;');
    expect(result).toContain('[POS:4] +  const y = 3;');
    expect(result).toContain('[POS:5] +  const z = 4;');
    expect(result).toContain('[POS:6]    return x + y;');
    
    // src/app.js - second hunk (7 = 6 + 1 for between hunks)
    expect(result).toContain('[POS:8]    let a = 1;');
    expect(result).toContain('[POS:9]    let b = 2;');
    expect(result).toContain('[POS:10] +  let c = 3;');
    expect(result).toContain('[POS:11]    return a + b;');
    
    // src/util.js - new file, positions reset
    const utilSection = result.split('diff --git a/src/util.js')[1];
    expect(utilSection).toContain('[POS:1] +import fs from \'fs\';');
    expect(utilSection).toContain('[POS:2]  export function util() {');
    expect(utilSection).toContain('[POS:3]    return true;');
  });
});