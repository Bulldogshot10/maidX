export interface LlamaRuntimeDeviceInfo {
  platform: string;
  manufacturer?: string | null;
  modelName?: string | null;
  totalMemory?: number | null;
}

export interface LlamaRuntimeProfile {
  maxContext: number;
  nThreads: number;
  nBatch: number;
  nUbatch: number;
  nParallel: number;
  nGpuLayers: number;
  useMlock: boolean;
  useMmap: boolean;
  noExtraBufts: boolean;
  forceCpuBackend: boolean;
}

const GIB = 1024 * 1024 * 1024;

/**
 * Conservative llama.cpp settings for mobile devices. In particular, do not
 * trust a GGUF's advertised training context as a safe allocation size.
 */
export function getLlamaRuntimeProfile(device: LlamaRuntimeDeviceInfo): LlamaRuntimeProfile {
  const isAndroid = device.platform.toLowerCase() === "android";
  const model = (device.modelName || "").toLowerCase();
  const manufacturer = (device.manufacturer || "").toLowerCase();

  // SM-S721* is the Galaxy S24 FE family. Expo does not expose a dependable
  // SoC identifier on every Android build, so target this device family by model.
  const isExynos2400eTarget =
    isAndroid &&
    (/sm-s721/.test(model) || /sm-s721/.test(manufacturer) ||
      /galaxy s24 fe/.test(model) || /exynos 2400e/.test(model));

  const totalMemory = typeof device.totalMemory === "number" && Number.isFinite(device.totalMemory) && device.totalMemory > 0
    ? device.totalMemory
    : undefined;

  // Keep KV-cache allocations predictable. A reported memory value can be
  // slightly below the marketed RAM because Android reserves part of it.
  let maxContext = 4096;
  if (totalMemory !== undefined && totalMemory <= 6.5 * GIB) {
    maxContext = 2048;
  } else if (totalMemory !== undefined && totalMemory >= 9.5 * GIB) {
    maxContext = 8192;
  }

  return {
    maxContext,
    // The S24 FE has 10 CPU cores; six threads is a practical starting point
    // without immediately saturating every efficiency core.
    nThreads: isExynos2400eTarget ? 6 : (totalMemory !== undefined && totalMemory <= 8.5 * GIB ? 4 : 6),
    nBatch: 256,
    nUbatch: 128,
    // Avoid llama.rn's much heavier multi-slot default for a single-user chat.
    nParallel: 1,
    // llama.rn currently documents Android OpenCL acceleration as tested on
    // Adreno. Keep this Exynos profile on the supported CPU path until Xclipse
    // acceleration is verified on-device.
    nGpuLayers: isExynos2400eTarget ? 0 : 99,
    // Let Android reclaim mapped pages under pressure rather than pinning the
    // whole model in RAM.
    useMlock: false,
    useMmap: true,
    noExtraBufts: true,
    forceCpuBackend: isExynos2400eTarget,
  };
}
