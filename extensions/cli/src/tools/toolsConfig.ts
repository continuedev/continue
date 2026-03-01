/**
 * Global configuration for tools system.
 * This stores command-line flags that affect tool availability.
 */

let betaUploadArtifactToolEnabled = false;

export function setBetaUploadArtifactToolEnabled(enabled: boolean): void {
  betaUploadArtifactToolEnabled = enabled;
}

export function isBetaUploadArtifactToolEnabled(): boolean {
  return betaUploadArtifactToolEnabled;
}
