import path from "path";

// Test the relative path conversion logic
const formatPath = (value) => {
  if (typeof value === "string" && path.isAbsolute(value)) {
    const workspaceRoot = process.cwd();
    const relativePath = path.relative(workspaceRoot, value);
    return relativePath || value;
  }
  return value;
};

// Test cases
console.log("Current working directory:", process.cwd());
console.log("Test absolute path:", `/Users/nate/gh/continuedev/wt-no-abs/src/continueSDK.ts`);
console.log("Converted to relative:", formatPath(`/Users/nate/gh/continuedev/wt-no-abs/src/continueSDK.ts`));
console.log("Test relative path:", `src/continueSDK.ts`);
console.log("Remains relative:", formatPath(`src/continueSDK.ts`));
console.log("Test root file:", `/Users/nate/gh/continuedev/wt-no-abs/package.json`);
console.log("Converted to relative:", formatPath(`/Users/nate/gh/continuedev/wt-no-abs/package.json`));