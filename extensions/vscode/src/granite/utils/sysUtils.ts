import { DiskSpace, SystemInfo } from "core/granite/commons/sysInfo";
import * as os from "os";
import * as si from "systeminformation";

// Returns the system's total and available memory
export function getSystemMemory() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  return { totalMemory, freeMemory };
}

// Returns the system's total number of CPUs
export function getSystemCPUs() {
  return os.cpus().length;
}

export async function getSystemDiskSpace(): Promise<DiskSpace> {
  try {
    const fsSize = await si.fsSize();
    const mainVolume = fsSize.find((drive) =>
      process.platform === "win32"
        ? drive.mount.toLowerCase().includes("c:")
        : drive.mount === "/",
    );
    if (mainVolume) {
      return {
        mount: mainVolume.mount,
        totalDiskSpace: mainVolume.size,
        freeDiskSpace: mainVolume.available,
      };
    }
    console.error("Main volume not found");
  } catch (error) {
    console.error("Error getting disk space:", error);
  }
  return { mount: "Unknown", totalDiskSpace: 0, freeDiskSpace: 0 };
}

// Returns the system's available GPUs
export async function getSystemGPUs(): Promise<
  { model: string; cores: number }[]
> {
  try {
    const gpus = await si.graphics();
    return gpus.controllers.map((controller) => ({
      model: controller.model,
      cores: controller.cores || 0,
    }));
  } catch (error) {
    console.error("Error detecting GPUs:", error);
    return [];
  }
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return {
    cpus: getSystemCPUs(),
    gpus: await getSystemGPUs(),
    diskSpace: await getSystemDiskSpace(),
    memory: getSystemMemory(),
  };
}
