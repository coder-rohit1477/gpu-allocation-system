import type { MaintenanceWindow, PrismaClient } from "@prisma/client";

export type MaintenanceDb = Pick<PrismaClient, "maintenanceWindow">;

/**
 * A node counts as "under active maintenance" when an admin has explicitly
 * marked a window IN_PROGRESS, or a SCHEDULED window's time range currently
 * covers `now`. This lets the health service report MAINTENANCE instead of
 * OFFLINE for a node that's expected to be dark right now — an offline node
 * during planned maintenance is not an incident.
 */
export async function getActiveMaintenanceWindow(
  db: MaintenanceDb,
  gpuNodeId: string,
  now: Date = new Date(),
): Promise<MaintenanceWindow | null> {
  return db.maintenanceWindow.findFirst({
    where: {
      gpuNodeId,
      OR: [
        { status: "IN_PROGRESS" },
        { status: "SCHEDULED", startTime: { lte: now }, endTime: { gte: now } },
      ],
    },
    orderBy: { startTime: "asc" },
  });
}

export async function getActiveMaintenanceWindowsFor(
  db: MaintenanceDb,
  gpuNodeIds: string[],
  now: Date = new Date(),
): Promise<MaintenanceWindow[]> {
  if (gpuNodeIds.length === 0) return [];
  return db.maintenanceWindow.findMany({
    where: {
      gpuNodeId: { in: gpuNodeIds },
      OR: [
        { status: "IN_PROGRESS" },
        { status: "SCHEDULED", startTime: { lte: now }, endTime: { gte: now } },
      ],
    },
  });
}
