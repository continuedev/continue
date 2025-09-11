/**
 * Optional profiling integration loader
 * This module handles the optional @sentry/profiling-node dependency
 * which contains native bindings and may not be available in all environments
 */

let profilingIntegration: any = null;
let profilingLoadAttempted = false;

/**
 * Lazy load the profiling integration
 */
async function loadProfilingIntegration() {
  if (profilingLoadAttempted) {
    return profilingIntegration;
  }

  profilingLoadAttempted = true;

  try {
    // Try to load the native profiling module if available
    const profilingModule = await import("@sentry/profiling-node");
    profilingIntegration = profilingModule.nodeProfilingIntegration;
  } catch {
    // Profiling module not available - this is fine, profiling is optional
    // The CLI will work without it, just without performance profiling
  }

  return profilingIntegration;
}

/**
 * Returns the profiling integration if available, or a no-op function
 * Note: This is now async to handle lazy loading
 */
export async function getProfilingIntegration() {
  const integration = await loadProfilingIntegration();
  if (integration) {
    return integration();
  }
  // Return empty object as a no-op integration
  return {};
}

/**
 * Check if profiling is available
 * Note: This is now async to handle lazy loading
 */
export async function isProfilingAvailable(): Promise<boolean> {
  await loadProfilingIntegration();
  return profilingIntegration !== null;
}
