import { describe, expect, it } from "vitest";
import { computeConnectivityStatus } from "../health.service.js";

const NOW = new Date("2026-08-16T12:00:00.000Z");

function secondsAgo(seconds: number): Date {
  return new Date(NOW.getTime() - seconds * 1000);
}

describe("computeConnectivityStatus", () => {
  it("is OFFLINE when there has never been a heartbeat", () => {
    expect(computeConnectivityStatus(null, NOW)).toBe("OFFLINE");
  });

  it("is ONLINE just under the online threshold", () => {
    expect(computeConnectivityStatus(secondsAgo(29), NOW, 30, 90)).toBe("ONLINE");
  });

  it("is ONLINE for a heartbeat this instant", () => {
    expect(computeConnectivityStatus(NOW, NOW, 30, 90)).toBe("ONLINE");
  });

  it("is DEGRADED exactly at the online threshold (inclusive lower bound of the DEGRADED band)", () => {
    expect(computeConnectivityStatus(secondsAgo(30), NOW, 30, 90)).toBe("DEGRADED");
  });

  it("is DEGRADED in the middle of the 30-90s band", () => {
    expect(computeConnectivityStatus(secondsAgo(60), NOW, 30, 90)).toBe("DEGRADED");
  });

  it("is DEGRADED exactly at the degraded threshold (inclusive upper bound)", () => {
    expect(computeConnectivityStatus(secondsAgo(90), NOW, 30, 90)).toBe("DEGRADED");
  });

  it("is OFFLINE just past the degraded threshold", () => {
    expect(computeConnectivityStatus(secondsAgo(91), NOW, 30, 90)).toBe("OFFLINE");
  });

  it("is OFFLINE long after the degraded threshold", () => {
    expect(computeConnectivityStatus(secondsAgo(3600), NOW, 30, 90)).toBe("OFFLINE");
  });

  it("uses the configured env thresholds by default", () => {
    // Defaults are 30/90 per .env.example — exercise the no-override call
    // path, relative to real wall-clock time since `now` isn't passed.
    const realNow = new Date();
    expect(computeConnectivityStatus(new Date(realNow.getTime() - 10_000))).toBe("ONLINE");
    expect(computeConnectivityStatus(new Date(realNow.getTime() - 200_000))).toBe("OFFLINE");
  });
});
