import { GB } from "./sizeUtils";
import { hasDiscreteGPU, isHighEndApple, SystemInfo } from "./sysInfo";
import { formatSize } from "./textUtils";

export interface ModelRequirements {
  minMemoryBytes: number;
  recommendedMemoryBytes: number;
  gpuRecommended: boolean;
  sizeBytes: number;
}

export const MODEL_REQUIREMENTS: Record<string, ModelRequirements> = {
  "granite3.2:2b": {
    minMemoryBytes: 4 * GB,
    recommendedMemoryBytes: 8 * GB,
    gpuRecommended: false,
    sizeBytes: Math.ceil(1.5 * GB),
  },
  "granite3.2:8b": {
    minMemoryBytes: 12 * GB,
    recommendedMemoryBytes: 16 * GB,
    gpuRecommended: true,
    sizeBytes: Math.ceil(4.9 * GB),
  },
  "nomic-embed-text:latest": {
    minMemoryBytes: 2 * GB,
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

export function checkModelCompatibility(
  modelId: string | null,
  systemInfo: SystemInfo | null,
): ValidationResult {
  if (!modelId || !systemInfo) {
    return { isCompatible: true, warnings: [], errors: [] };
  }

  const requirements = MODEL_REQUIREMENTS[modelId];
  if (!requirements) {
    return { isCompatible: true, warnings: [], errors: [] };
  }

  const warnings: string[] = [];
  const errors: string[] = [];
  const totalMemoryBytes = systemInfo.memory.totalMemory;
  const hasGoodGPU =
    hasDiscreteGPU(systemInfo.gpus) || isHighEndApple(systemInfo.gpus);

  // const freeDiskBytes = systemInfo.diskSpace.freeDiskSpace;
  // if (freeDiskBytes < requirements.sizeBytes) {
  //   errors.push(
  //     `Insufficient disk space. Model needs ${formatSize(requirements.sizeBytes)}, ` +
  //     `you only have ${formatSize(freeDiskBytes)} free.`
  //   );
  // }

  if (totalMemoryBytes < requirements.minMemoryBytes) {
    warnings.push(
      `This model requires at least ${formatSize(requirements.minMemoryBytes)} of RAM. ` +
        `Your system has ${formatSize(totalMemoryBytes)}.`,
    );
  } else if (totalMemoryBytes < requirements.recommendedMemoryBytes) {
    warnings.push(
      `This model runs best with ${formatSize(requirements.recommendedMemoryBytes)} of RAM. ` +
        `Your system has ${formatSize(totalMemoryBytes)}.`,
    );
  }

  if (requirements.gpuRecommended && !hasGoodGPU) {
    warnings.push(
      "This model performs better with a discrete NVidia or AMD GPU, or an Apple M2+ chip.",
    );
  }

  return {
    isCompatible: errors.length === 0,
    warnings,
    errors,
  };
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
