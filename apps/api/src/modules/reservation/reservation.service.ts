import type { GpuNode, PrismaClient, Reservation } from "@prisma/client";
import { badRequestError, conflictError, notFoundError } from "../../common/errors.js";
import {
  buildPaginatedResult,
  paginationArgs,
  type PaginatedResult,
} from "../../common/pagination.js";
// Reusing Phase 5's telemetry health service — the source of truth for
// heartbeat-derived ONLINE/DEGRADED/OFFLINE connectivity — via its public
// API, not modifying it. "Only ONLINE GPU nodes may be reserved" refers to
// this connectivity status, not the admin-controlled GpuNode.status enum
// (AVAILABLE/BUSY/MAINTENANCE/OFFLINE), which this module deliberately
// leaves untouched.
import * as telemetryService from "../telemetry/telemetry.service.js";
import { selectBestFitNode } from "./allocator.service.js";
import { checkConflicts, isConflictFree } from "./conflictDetection.service.js";
import { recordReservationAuditEvent } from "./reservation.audit.js";
import * as reservationRepository from "./reservation.repository.js";
import type {
  CreateReservationInput,
  GpuNodeAvailabilityQuery,
  ListMyReservationsQuery,
  ListPendingReservationsQuery,
  RejectReservationInput,
} from "./reservation.dto.js";

export type ReservationServiceDb = Pick<
  PrismaClient,
  | "reservation"
  | "gpuNode"
  | "laboratory"
  | "course"
  | "user"
  | "maintenanceWindow"
  | "gpuHealthSnapshot"
  | "gpuMetric"
  | "allocationSession"
  | "auditLog"
>;

async function getReservationOr404(db: ReservationServiceDb, id: string): Promise<Reservation> {
  const reservation = await reservationRepository.findReservationById(db, id);
  if (!reservation) throw notFoundError("Reservation", id);
  return reservation;
}

async function assertNodeIsBookable(
  db: ReservationServiceDb,
  node: GpuNode,
  startTime: Date,
  endTime: Date,
  now: Date,
): Promise<void> {
  const health = await telemetryService.getNodeHealth(db, node.id, now);
  if (health.connectivityStatus !== "ONLINE") {
    throw conflictError(
      `GPU node "${node.hostname}" is ${health.connectivityStatus}, not ONLINE, and cannot be reserved`,
    );
  }

  const conflicts = await checkConflicts(db, node.id, startTime, endTime);
  if (conflicts.hasReservationConflict) {
    throw conflictError(
      `GPU node "${node.hostname}" is already reserved for an overlapping time range`,
    );
  }
  if (conflicts.hasMaintenanceConflict) {
    throw conflictError(
      `GPU node "${node.hostname}" has a maintenance window overlapping this time range`,
    );
  }
}

/**
 * Smart GPU Allocator's DB-touching half: fetches nodes in the lab, filters
 * to those currently ONLINE and conflict-free for the window, then defers
 * to allocator.service.ts's pure best-fit selection. Sequential rather than
 * Promise.all across nodes — labs are small (tens of nodes, not thousands),
 * and sequential keeps this readable; revisit if that stops being true.
 */
async function allocateNode(
  db: ReservationServiceDb,
  labId: string,
  startTime: Date,
  endTime: Date,
  now: Date,
  requirements: { minGpuCount: number; minMemoryGB: number },
): Promise<GpuNode> {
  const lab = await db.laboratory.findUnique({ where: { id: labId } });
  if (!lab) throw badRequestError(`Laboratory "${labId}" does not exist`);

  const nodesInLab = await db.gpuNode.findMany({ where: { labId } });
  const eligible: GpuNode[] = [];

  for (const node of nodesInLab) {
    if (node.gpuCount < requirements.minGpuCount || node.totalMemoryGB < requirements.minMemoryGB) {
      continue;
    }
    const health = await telemetryService.getNodeHealth(db, node.id, now);
    if (health.connectivityStatus !== "ONLINE") continue;

    const conflicts = await checkConflicts(db, node.id, startTime, endTime);
    if (!isConflictFree(conflicts)) continue;

    eligible.push(node);
  }

  const chosen = selectBestFitNode(eligible, requirements);
  if (!chosen) {
    throw conflictError(
      `No ONLINE, conflict-free GPU node in laboratory "${labId}" satisfies the request for the given time range`,
    );
  }
  return chosen;
}

export async function createReservation(
  db: ReservationServiceDb,
  actorId: string,
  input: CreateReservationInput,
): Promise<Reservation> {
  const now = new Date();
  if (input.startTime.getTime() < now.getTime()) {
    throw badRequestError("startTime cannot be in the past");
  }

  if (input.courseId) {
    const course = await db.course.findUnique({ where: { id: input.courseId } });
    if (!course) throw badRequestError(`Course "${input.courseId}" does not exist`);
  }

  let targetNode: GpuNode;
  if (input.gpuNodeId) {
    const node = await db.gpuNode.findUnique({ where: { id: input.gpuNodeId } });
    if (!node) throw notFoundError("GPU node", input.gpuNodeId);
    await assertNodeIsBookable(db, node, input.startTime, input.endTime, now);
    targetNode = node;
  } else {
    targetNode = await allocateNode(db, input.labId!, input.startTime, input.endTime, now, {
      minGpuCount: input.minGpuCount ?? 1,
      minMemoryGB: input.minMemoryGB ?? 0,
    });
  }

  const reservation = await reservationRepository.createReservation(db, {
    user: { connect: { id: actorId } },
    gpuNode: { connect: { id: targetNode.id } },
    course: input.courseId ? { connect: { id: input.courseId } } : undefined,
    startTime: input.startTime,
    endTime: input.endTime,
    purpose: input.purpose,
  });

  await recordReservationAuditEvent(db, {
    actorId,
    action: "RESERVATION_CREATED",
    resourceId: reservation.id,
    metadata: { gpuNodeId: targetNode.id, startTime: input.startTime, endTime: input.endTime },
  });

  return reservation;
}

export async function listMyReservations(
  db: ReservationServiceDb,
  userId: string,
  query: ListMyReservationsQuery,
): Promise<PaginatedResult<Reservation>> {
  const { skip, take } = paginationArgs(query);
  const [items, total] = await Promise.all([
    reservationRepository.listReservationsForUser(db, { userId, status: query.status, skip, take }),
    reservationRepository.countReservationsForUser(db, { userId, status: query.status }),
  ]);
  return buildPaginatedResult(items, total, query);
}

const CANCELLABLE_STATUSES: Reservation["status"][] = ["PENDING", "APPROVED"];

export async function cancelReservation(
  db: ReservationServiceDb,
  actorId: string,
  id: string,
): Promise<Reservation> {
  const reservation = await getReservationOr404(db, id);
  if (!CANCELLABLE_STATUSES.includes(reservation.status)) {
    throw conflictError(`Reservation cannot be cancelled from status "${reservation.status}"`);
  }

  const updated = await reservationRepository.updateReservationStatus(db, id, "CANCELLED");

  await recordReservationAuditEvent(db, {
    actorId,
    action: "RESERVATION_CANCELLED",
    resourceId: id,
    metadata: { from: reservation.status },
  });

  return updated;
}

export async function listPendingReservationsForFaculty(
  db: ReservationServiceDb,
  facultyUserId: string,
  query: ListPendingReservationsQuery,
): Promise<PaginatedResult<Reservation>> {
  const faculty = await db.user.findUnique({ where: { id: facultyUserId } });
  if (!faculty?.departmentId) return buildPaginatedResult([], 0, query);

  const { skip, take } = paginationArgs(query);
  const [items, total] = await Promise.all([
    reservationRepository.listPendingReservationsInDepartment(db, {
      departmentId: faculty.departmentId,
      skip,
      take,
    }),
    reservationRepository.countPendingReservationsInDepartment(db, faculty.departmentId),
  ]);
  return buildPaginatedResult(items, total, query);
}

export async function approveReservation(
  db: ReservationServiceDb,
  actorId: string,
  id: string,
): Promise<Reservation> {
  const reservation = await getReservationOr404(db, id);
  if (reservation.status !== "PENDING") {
    throw conflictError(`Reservation cannot be approved from status "${reservation.status}"`);
  }

  const updated = await reservationRepository.updateReservationStatus(db, id, "APPROVED");

  await recordReservationAuditEvent(db, {
    actorId,
    action: "RESERVATION_APPROVED",
    resourceId: id,
  });

  return updated;
}

export async function rejectReservation(
  db: ReservationServiceDb,
  actorId: string,
  id: string,
  input: RejectReservationInput,
): Promise<Reservation> {
  const reservation = await getReservationOr404(db, id);
  if (reservation.status !== "PENDING") {
    throw conflictError(`Reservation cannot be rejected from status "${reservation.status}"`);
  }

  const updated = await reservationRepository.updateReservationStatus(db, id, "REJECTED");

  await recordReservationAuditEvent(db, {
    actorId,
    action: "RESERVATION_REJECTED",
    resourceId: id,
    metadata: input.reason ? { reason: input.reason } : undefined,
  });

  return updated;
}

export interface GpuNodeAvailabilityView {
  gpuNodeId: string;
  hostname: string;
  labId: string;
  gpuModel: string;
  gpuCount: number;
  totalMemoryGB: number;
  connectivityStatus: telemetryService.NodeHealthView["connectivityStatus"];
  available: boolean;
}

export async function getGpuNodeAvailability(
  db: ReservationServiceDb,
  query: GpuNodeAvailabilityQuery,
): Promise<GpuNodeAvailabilityView[]> {
  const now = new Date();
  const nodes = await db.gpuNode.findMany({
    where: query.labId ? { labId: query.labId } : undefined,
    orderBy: { hostname: "asc" },
  });

  const views = await Promise.all(
    nodes.map(async (node): Promise<GpuNodeAvailabilityView> => {
      const health = await telemetryService.getNodeHealth(db, node.id, now);
      const meetsRequirements =
        (!query.minGpuCount || node.gpuCount >= query.minGpuCount) &&
        (!query.minMemoryGB || node.totalMemoryGB >= query.minMemoryGB);

      let conflictFree = true;
      if (query.startTime && query.endTime) {
        const conflicts = await checkConflicts(db, node.id, query.startTime, query.endTime);
        conflictFree = isConflictFree(conflicts);
      }

      return {
        gpuNodeId: node.id,
        hostname: node.hostname,
        labId: node.labId,
        gpuModel: node.gpuModel,
        gpuCount: node.gpuCount,
        totalMemoryGB: node.totalMemoryGB,
        connectivityStatus: health.connectivityStatus,
        available: health.connectivityStatus === "ONLINE" && meetsRequirements && conflictFree,
      };
    }),
  );

  return views;
}

export interface LaboratoryCalendarView {
  laboratoryId: string;
  from: string;
  to: string;
  nodes: { id: string; hostname: string }[];
  reservations: {
    id: string;
    gpuNodeId: string;
    userId: string;
    status: Reservation["status"];
    startTime: string;
    endTime: string;
  }[];
  maintenanceWindows: {
    id: string;
    gpuNodeId: string;
    status: string;
    startTime: string;
    endTime: string;
  }[];
}

export async function getLaboratoryCalendar(
  db: ReservationServiceDb,
  laboratoryId: string,
  range: { from: Date; to: Date },
): Promise<LaboratoryCalendarView> {
  const laboratory = await db.laboratory.findUnique({ where: { id: laboratoryId } });
  if (!laboratory) throw notFoundError("Laboratory", laboratoryId);

  const nodes = await db.gpuNode.findMany({
    where: { labId: laboratoryId },
    select: { id: true, hostname: true },
    orderBy: { hostname: "asc" },
  });
  const nodeIds = nodes.map((node) => node.id);

  const [reservations, maintenanceWindows] = await Promise.all([
    reservationRepository.listReservationsForNodesInRange(db, nodeIds, range.from, range.to),
    reservationRepository.listMaintenanceWindowsForNodesInRange(db, nodeIds, range.from, range.to),
  ]);

  return {
    laboratoryId,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    nodes,
    reservations: reservations.map((r) => ({
      id: r.id,
      gpuNodeId: r.gpuNodeId,
      userId: r.userId,
      status: r.status,
      startTime: r.startTime.toISOString(),
      endTime: r.endTime.toISOString(),
    })),
    maintenanceWindows: maintenanceWindows.map((m) => ({
      id: m.id,
      gpuNodeId: m.gpuNodeId,
      status: m.status,
      startTime: m.startTime.toISOString(),
      endTime: m.endTime.toISOString(),
    })),
  };
}
