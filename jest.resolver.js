module.exports = (path, options) => {
  // Call the default resolver
  const resolver = options.defaultResolver;

  try {
    // Try to resolve the path as-is first
    return resolver(path, options);
  } catch (error) {
    // If the path ends with .js and resolution fails, try without the extension
    if (path.endsWith(".js")) {
      const pathWithoutJs = path.slice(0, -3);
      try {
        return resolver(pathWithoutJs, options);
      } catch {
        // If that also fails, try with .ts extension
        try {
          return resolver(pathWithoutJs + ".ts", options);
        } catch {
          // If that also fails, try with .tsx extension
          try {
            return resolver(pathWithoutJs + ".tsx", options);
          } catch {
            // If all attempts fail, throw the original error
            throw error;
          }
        }
      }
    }
    throw error;
  }
};
