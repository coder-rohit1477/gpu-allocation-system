export interface SimulatedMetrics {
  gpuUtilization: number;
  memoryUsedGB: number;
  temperature: number;
  powerDraw: number;
  activeProcesses: number;
}

// Small string hash → stable per-hostname seed, so each simulated node has
// its own consistent "personality" (a busier node vs. a quieter one) rather
// than every node reporting identical numbers.
function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Deterministic given (hostname, tick) — same inputs always produce the
 * same reading, no Math.random(). Utilization oscillates smoothly over
 * time (a sine wave, phase-shifted per node via the hostname hash) around
 * a per-node baseline, and the other readings are derived from that
 * utilization so they move together the way a real GPU's telemetry would.
 */
export function generateMetrics(hostname: string, tick: number): SimulatedMetrics {
  const seed = hashString(hostname);
  const baseline = 25 + (seed % 40); // per-node baseline utilization, 25-64%
  const phase = (seed % 1000) / 1000; // 0-1, spreads nodes' wave peaks apart
  const wave = Math.sin(tick / 6 + phase * Math.PI * 2);

  const gpuUtilization = clamp(Math.round(baseline + wave * 20), 2, 98);
  const memoryUsedGB = clamp(Math.round((4 + (seed % 12) + gpuUtilization * 0.3) * 10) / 10, 1, 78);
  const temperature = clamp(Math.round(42 + gpuUtilization * 0.4 + (seed % 5)), 30, 89);
  const powerDraw = clamp(Math.round(70 + gpuUtilization * 3.2 + (seed % 30)), 40, 480);
  const activeProcesses = clamp(Math.round(gpuUtilization / 18 + (seed % 3)), 0, 9);

  return { gpuUtilization, memoryUsedGB, temperature, powerDraw, activeProcesses };
}
