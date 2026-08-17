import { describe, expect, it } from "vitest";
import { selectBestFitNode } from "../allocator.service.js";

describe("selectBestFitNode", () => {
  it("returns null when no candidate meets the requirement", () => {
    const result = selectBestFitNode(
      [{ id: "a", gpuCount: 2, totalMemoryGB: 40 }],
      { minGpuCount: 4, minMemoryGB: 0 },
    );
    expect(result).toBeNull();
  });

  it("picks the smallest eligible node rather than the first one found", () => {
    const result = selectBestFitNode(
      [
        { id: "big", gpuCount: 8, totalMemoryGB: 640 },
        { id: "small-eligible", gpuCount: 4, totalMemoryGB: 320 },
        { id: "too-small", gpuCount: 2, totalMemoryGB: 160 },
      ],
      { minGpuCount: 4, minMemoryGB: 0 },
    );
    expect(result?.id).toBe("small-eligible");
  });

  it("breaks a gpuCount tie by picking the smaller totalMemoryGB", () => {
    const result = selectBestFitNode(
      [
        { id: "same-count-more-mem", gpuCount: 4, totalMemoryGB: 640 },
        { id: "same-count-less-mem", gpuCount: 4, totalMemoryGB: 320 },
      ],
      { minGpuCount: 4, minMemoryGB: 0 },
    );
    expect(result?.id).toBe("same-count-less-mem");
  });

  it("filters out nodes that fail the memory requirement even if gpuCount is sufficient", () => {
    const result = selectBestFitNode(
      [{ id: "low-mem", gpuCount: 8, totalMemoryGB: 16 }],
      { minGpuCount: 4, minMemoryGB: 320 },
    );
    expect(result).toBeNull();
  });

  it("returns null for an empty candidate list", () => {
    expect(selectBestFitNode([], { minGpuCount: 1, minMemoryGB: 0 })).toBeNull();
  });
});
