import type {
  MaintenanceWindow,
  Prisma,
  PrismaClient,
  Reservation,
  ReservationStatus,
} from "@prisma/client";

export type ReservationDb = Pick<PrismaClient, "reservation">;
export type MaintenanceWindowDb = Pick<PrismaClient, "maintenanceWindow">;

/** Reservation statuses that currently hold a claim on a GPU node's time. */
const HOLDING_STATUSES: ReservationStatus[] = ["PENDING", "APPROVED", "ACTIVE"];

export async function findReservationById(
  db: ReservationDb,
  id: string,
): Promise<Reservation | null> {
  return db.reservation.findUnique({ where: { id } });
}

export async function createReservation(
  db: ReservationDb,
  data: Prisma.ReservationCreateInput,
): Promise<Reservation> {
  return db.reservation.create({ data });
}

export async function updateReservationStatus(
  db: ReservationDb,
  id: string,
  status: ReservationStatus,
): Promise<Reservation> {
  return db.reservation.update({ where: { id }, data: { status } });
}

interface ListForUserArgs {
  userId: string;
  status?: ReservationStatus;
  skip: number;
  take: number;
}

export async function listReservationsForUser(
  db: ReservationDb,
  args: ListForUserArgs,
): Promise<Reservation[]> {
  return db.reservation.findMany({
    where: { userId: args.userId, status: args.status },
    orderBy: { startTime: "desc" },
    skip: args.skip,
    take: args.take,
  });
}

export async function countReservationsForUser(
  db: ReservationDb,
  args: { userId: string; status?: ReservationStatus },
): Promise<number> {
  return db.reservation.count({ where: { userId: args.userId, status: args.status } });
}

interface ListPendingInDepartmentArgs {
  departmentId: string;
  skip: number;
  take: number;
}

export async function listPendingReservationsInDepartment(
  db: ReservationDb,
  args: ListPendingInDepartmentArgs,
): Promise<Reservation[]> {
  return db.reservation.findMany({
    where: { status: "PENDING", gpuNode: { laboratory: { departmentId: args.departmentId } } },
    orderBy: { startTime: "asc" },
    skip: args.skip,
    take: args.take,
  });
}

export async function countPendingReservationsInDepartment(
  db: ReservationDb,
  departmentId: string,
): Promise<number> {
  return db.reservation.count({
    where: { status: "PENDING", gpuNode: { laboratory: { departmentId } } },
  });
}

/**
 * Reservations for a node that would conflict with [startTime, endTime) —
 * only PENDING/APPROVED/ACTIVE hold a claim; REJECTED/CANCELLED/COMPLETED
 * free up the slot. `excludeReservationId` lets a re-check (e.g. re-running
 * the sweep) ignore the reservation being evaluated itself.
 */
export async function findOverlappingReservations(
  db: ReservationDb,
  gpuNodeId: string,
  startTime: Date,
  endTime: Date,
  excludeReservationId?: string,
): Promise<Reservation[]> {
  return db.reservation.findMany({
    where: {
      gpuNodeId,
      status: { in: HOLDING_STATUSES },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
  });
}

export async function listReservationsForNodesInRange(
  db: ReservationDb,
  gpuNodeIds: string[],
  from: Date,
  to: Date,
): Promise<Reservation[]> {
  if (gpuNodeIds.length === 0) return [];
  return db.reservation.findMany({
    where: {
      gpuNodeId: { in: gpuNodeIds },
      startTime: { lt: to },
      endTime: { gt: from },
    },
    orderBy: { startTime: "asc" },
  });
}

export async function findReservationsToActivate(
  db: ReservationDb,
  now: Date,
): Promise<Reservation[]> {
  return db.reservation.findMany({ where: { status: "APPROVED", startTime: { lte: now } } });
}

export async function findReservationsToComplete(
  db: ReservationDb,
  now: Date,
): Promise<Reservation[]> {
  return db.reservation.findMany({ where: { status: "ACTIVE", endTime: { lte: now } } });
}

/** Maintenance windows (SCHEDULED or IN_PROGRESS — COMPLETED never blocks) overlapping [startTime, endTime). */
export async function findOverlappingMaintenanceWindows(
  db: MaintenanceWindowDb,
  gpuNodeId: string,
  startTime: Date,
  endTime: Date,
): Promise<MaintenanceWindow[]> {
  return db.maintenanceWindow.findMany({
    where: {
      gpuNodeId,
      status: { in: ["SCHEDULED", "IN_PROGRESS"] },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });
}

export async function listMaintenanceWindowsForNodesInRange(
  db: MaintenanceWindowDb,
  gpuNodeIds: string[],
  from: Date,
  to: Date,
): Promise<MaintenanceWindow[]> {
  if (gpuNodeIds.length === 0) return [];
  return db.maintenanceWindow.findMany({
    where: {
      gpuNodeId: { in: gpuNodeIds },
      startTime: { lt: to },
      endTime: { gt: from },
    },
    orderBy: { startTime: "asc" },
  });
}
