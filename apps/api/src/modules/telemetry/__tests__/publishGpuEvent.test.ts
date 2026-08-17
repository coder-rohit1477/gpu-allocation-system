import { describe, expect, it, vi } from "vitest";
import { GPU_HEALTH_CHANNEL, publishGpuHealthEvent, type Publisher } from "../publishGpuEvent.js";

const SAMPLE_EVENT = {
  gpuNodeId: "node-1",
  hostname: "gpu-01.muj.local",
  status: "ONLINE" as const,
  gpuUtilization: 42,
  memoryUsedGB: 12.5,
  temperature: 61,
  powerDraw: 250,
  activeProcesses: 3,
  lastHeartbeat: "2026-08-16T12:00:00.000Z",
};

describe("publishGpuHealthEvent", () => {
  it("publishes the event as JSON on the gpu health channel", async () => {
    const publish = vi.fn().mockResolvedValue(1);
    const publisher: Publisher = { publish };

    await publishGpuHealthEvent(publisher, SAMPLE_EVENT);

    expect(publish).toHaveBeenCalledOnce();
    const [channel, payload] = publish.mock.calls[0]!;
    expect(channel).toBe(GPU_HEALTH_CHANNEL);
    expect(JSON.parse(payload as string)).toEqual(SAMPLE_EVENT);
  });

  it("swallows publish errors rather than throwing (Redis is best-effort)", async () => {
    const publish = vi.fn().mockRejectedValue(new Error("connection refused"));
    const publisher: Publisher = { publish };

    await expect(publishGpuHealthEvent(publisher, SAMPLE_EVENT)).resolves.toBeUndefined();
  });
});
