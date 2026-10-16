import { getLlamaRuntimeProfile } from "../context/language-model/runtime-profile";

const GIB = 1024 * 1024 * 1024;

describe("getLlamaRuntimeProfile", () => {
  it("uses a memory-safe CPU profile for the Galaxy S24 FE / Exynos 2400e", () => {
    const profile = getLlamaRuntimeProfile({
      platform: "android",
      manufacturer: "samsung",
      modelName: "SM-S721B",
      totalMemory: 7.5 * GIB,
    });

    expect(profile.maxContext).toBe(4096);
    expect(profile.nThreads).toBe(6);
    expect(profile.nParallel).toBe(1);
    expect(profile.nGpuLayers).toBe(0);
    expect(profile.useMlock).toBe(false);
    expect(profile.useMmap).toBe(true);
    expect(profile.noExtraBufts).toBe(true);
    expect(profile.forceCpuBackend).toBe(true);
  });

  it("reduces context on devices with 6 GB RAM or less", () => {
    const profile = getLlamaRuntimeProfile({
      platform: "android",
      manufacturer: "Google",
      modelName: "Pixel",
      totalMemory: 6 * GIB,
    });

    expect(profile.maxContext).toBe(2048);
    expect(profile.nParallel).toBe(1);
    expect(profile.useMlock).toBe(false);
  });

  it("allows a larger context budget on devices with 12 GB RAM", () => {
    const profile = getLlamaRuntimeProfile({
      platform: "android",
      manufacturer: "Samsung",
      modelName: "SM-S928B",
      totalMemory: 12 * GIB,
    });

    expect(profile.maxContext).toBe(8192);
    expect(profile.forceCpuBackend).toBe(false);
    expect(profile.nGpuLayers).toBe(99);
  });

  it("does not apply the Exynos CPU-only override to other platforms", () => {
    const profile = getLlamaRuntimeProfile({
      platform: "ios",
      manufacturer: "Apple",
      modelName: "iPhone",
      totalMemory: 8 * GIB,
    });

    expect(profile.forceCpuBackend).toBe(false);
    expect(profile.nGpuLayers).toBe(99);
  });

  it("chooses a conservative context limit when memory data is unavailable", () => {
    const profile = getLlamaRuntimeProfile({
      platform: "android",
      manufacturer: "unknown",
      modelName: "unknown",
    });

    expect(profile.maxContext).toBe(4096);
  });
});
