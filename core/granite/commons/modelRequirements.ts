import { GB } from "./sizeUtils";
import { SystemInfo } from "./sysInfo";
import { formatSize } from "./textUtils";

export interface ModelRequirements {
  recommendedMemoryBytes: number;
  gpuRecommended: boolean;
  sizeBytes: number;
}

export const MODEL_REQUIREMENTS: Record<string, ModelRequirements> = {
  "granite3.2:2b": {
    recommendedMemoryBytes: 4 * GB,
    gpuRecommended: false,
    sizeBytes: Math.ceil(1.5 * GB),
  },
  "granite3.2:8b": {
    recommendedMemoryBytes: 10 * GB,
    gpuRecommended: true,
    sizeBytes: Math.ceil(4.9 * GB),
  },
  "nomic-embed-text:latest": {
    recommendedMemoryBytes: 4 * GB,
    gpuRecommended: false,
    sizeBytes: Math.ceil(0.274 * GB),
  },
};

export const DOWNLOADABLE_MODELS = Object.keys(MODEL_REQUIREMENTS);

interface ValidationResult {
  isCompatible: boolean;
  warnings: string[];
  errors: string[];
}

export function checkCombinedDiskSpace(
  selectedModels: string[],
  systemInfo: SystemInfo | null,
): ValidationResult {
  if (!systemInfo || selectedModels.length === 0) {
    return { isCompatible: true, warnings: [], errors: [] };
  }

  const warnings: string[] = [];
  const errors: string[] = [];
  const freeDiskBytes = systemInfo.diskSpace.freeDiskSpace;

  const totalSizeBytes = selectedModels.reduce((total, modelId) => {
    const requirements = MODEL_REQUIREMENTS[modelId];
    return total + (requirements?.sizeBytes || 0);
  }, 0);

  if (totalSizeBytes > freeDiskBytes) {
    errors.push(
      `Insufficient disk space for selected models. Required: ${formatSize(totalSizeBytes)}, ` +
        `Available: ${formatSize(freeDiskBytes)}`,
    );
  } else if (totalSizeBytes > freeDiskBytes * 0.8) {
    warnings.push(
      `Selected models will use ${formatSize(totalSizeBytes)} of your ` +
        `${formatSize(freeDiskBytes)} available disk space`,
    );
  }

  return {
    isCompatible: errors.length === 0,
    warnings,
    errors,
  };
}
