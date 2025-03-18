import { DEFAULT_MODEL_GRANITE_LARGE } from "../../config/default";
import { MODEL_REQUIREMENTS } from "./modelRequirements";
import { GB } from "./sizeUtils";

// All the system's information
export interface SystemInfo {
  memory: {
    totalMemory: number;
    freeMemory: number;
  };
  cpus: number;
  diskSpace: DiskSpace;
  gpus: { model: string; cores: number; vram: number }[];
}

export interface GpuInfo {
  model: string;
  cores: number;
}

// The system's available disk space
export interface DiskSpace {
  mount: string;
  totalDiskSpace: number;
  freeDiskSpace: number;
}

/**
 * Determines if the system is considered high-end based on its GPU power and total memory.
 * A machine is considered high-end if it has a discrete NVidia or AMD GPU, or an Apple M2+ chip, and if it has at least 32GB of total memory.
 *
 * @param systemInfo - The system's information.
 * @returns {boolean} - True if the system is considered high-end, false otherwise.
 */
export function isHighEndMachine(systemInfo: SystemInfo): boolean {
  const hasEnoughGPUPower =
    hasDiscreteGPU(systemInfo.gpus) || isHighEndApple(systemInfo.gpus);
  const totalMemoryGB = systemInfo.memory.totalMemory;
  return hasEnoughGPUPower && totalMemoryGB >= 32 * GB;
}

export function isHighEndApple(gpus: GpuInfo[]): boolean {
  const matches = gpus.map((gpu) =>
    gpu.model.toLocaleLowerCase().match(/apple m(\d+)/),
  );
  const match = matches.find((match) => match !== null);
  if (!match) {
    return false;
  }
  const siliconVersion = parseInt(match[1], 10);
  return siliconVersion > 2; // High-end found if GPU found is Apple M2 or more recent
}

export function hasDiscreteGPU(gpus: GpuInfo[]): boolean {
  return gpus.some((gpu) => {
    const model = gpu.model.toLowerCase();
    // Check for common discrete GPU manufacturers
    return model.includes("nvidia") || model.includes("amd");
    // TODO to be more precise, we might want to look for specific GPU Models from those brands
  });
}

export function getRecommendedModels(systemInfo: SystemInfo) {
  const defaultGraniteModel = isHighEndMachine(systemInfo)
    ? "granite3.2:8b" // 8B for powerful systems
    : "granite3.2:2b"; // 2B for others

  return {
    defaultChatModel: defaultGraniteModel,
    defaultTabModel: defaultGraniteModel,
    defaultEmbeddingsModel: "nomic-embed-text:latest",
  };
}

export function shouldRecommendLargeModel(systemInfo: SystemInfo): boolean {
  const requirements = MODEL_REQUIREMENTS[DEFAULT_MODEL_GRANITE_LARGE.model];
  if (!requirements) return false;

  if (isHighEndApple(systemInfo.gpus))
    return systemInfo.memory.totalMemory >= requirements.recommendedMemoryBytes;

  if (!hasDiscreteGPU(systemInfo.gpus)) return false;

  const maxVRAM = systemInfo.gpus.reduce((max, gpu) => {
    return Math.max(max, (gpu.vram || 0) * GB);
  }, 0);

  return maxVRAM >= requirements.recommendedMemoryBytes;
}
