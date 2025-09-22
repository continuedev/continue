/**
 * Simplified Shihuo user info utilities
 * This replaces the complex provider pattern with a simple utility function
 */

export interface ShihuoUserInfo {
  name: string;
  dept_name: string;
}

/**
 * Get Shihuo user information with fallback to environment variables
 * This function handles all the complexity of user info retrieval in one place
 */
export async function getShihuoUserInfo(): Promise<ShihuoUserInfo> {
  try {
    // Try to get from Shihuo session (only available in VSCode extension)
    const { getShihuoSessionInfo } = await import(
      "../../extensions/vscode/src/stubs/ShihuoAuthProvider"
    );
    const sessionInfo = await getShihuoSessionInfo(true); // silent = true

    if (sessionInfo && "account" in sessionInfo && sessionInfo.account) {
      return {
        name: sessionInfo.account.label || "",
        dept_name: (sessionInfo.account as any).dept_name || "",
      };
    }
  } catch (error) {
    // This is expected in non-VSCode environments or when Shihuo is not available
    console.debug(
      "Shihuo session not available, falling back to environment variables:",
      error,
    );
  }

  // Fallback to environment variables
  return {
    name: process.env.USER_NAME || "",
    dept_name: process.env.DEPT_NAME || "",
  };
}

/**
 * Get user info synchronously (for cases where async is not possible)
 * This will only return environment variable values
 */
export function getShihuoUserInfoSync(): ShihuoUserInfo {
  return {
    name: process.env.USER_NAME || "",
    dept_name: process.env.DEPT_NAME || "",
  };
}
