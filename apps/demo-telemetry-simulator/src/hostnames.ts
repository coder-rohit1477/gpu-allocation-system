import { env } from "./config/env.js";

/**
 * Reproduces apps/api/prisma/seed.ts's GPU node hostname derivation
 * exactly: `${deptCode}-gpu-node-${NN}.muj.local`, N nodes per department,
 * departments in a fixed order. Kept in lockstep with the seed script by
 * convention (both are small and rarely change); if the seed script's node
 * count/department list ever changes, update `env.departments` /
 * `env.nodesPerDepartment` (via DEMO_SIMULATOR_DEPARTMENTS /
 * DEMO_SIMULATOR_NODES_PER_DEPARTMENT) rather than the seed script itself.
 */
export function generateSimulatedHostnames(): string[] {
  const hostnames: string[] = [];
  for (const dept of env.departments) {
    for (let i = 1; i <= env.nodesPerDepartment; i++) {
      hostnames.push(`${dept}-gpu-node-${String(i).padStart(2, "0")}${env.hostnameSuffix}`);
    }
  }
  return hostnames;
}
