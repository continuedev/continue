// Custom resolver for Jest to handle .js extensions in ESM project
const path = require('path');
const fs = require('fs');

module.exports = (request, options) => {
  // Call the default resolver
  const defaultResolver = options.defaultResolver;
  
  // First try the default resolver
  try {
    return defaultResolver(request, options);
  } catch (e) {
    // Only continue if module not found
    if (!e.message || !e.message.includes('Cannot find module')) {
      throw e;
    }
  }
  
  // Handle relative imports
  if (request.startsWith('.')) {
    const basePath = options.basedir;
    const fullPath = path.resolve(basePath, request);
    
    // Try various extensions
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    
    for (const ext of extensions) {
      const testPath = fullPath + ext;
      try {
        if (fs.existsSync(testPath)) {
          return defaultResolver(testPath, options);
        }
      } catch (e) {
        // Continue to next extension
      }
    }
    
    // Also try adding /index with various extensions
    for (const ext of extensions) {
      const testPath = path.join(fullPath, 'index' + ext);
      try {
        if (fs.existsSync(testPath)) {
          return defaultResolver(testPath, options);
        }
      } catch (e) {
        // Continue to next extension
      }
    }
  }
  
  // If still not found, throw original error
  throw new Error(`Cannot find module '${request}'`);
};