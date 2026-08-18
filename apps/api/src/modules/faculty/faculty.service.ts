import type { PrismaClient, Reservation, ReservationStatus } from "@prisma/client";
import { conflictError, forbiddenError, notFoundError } from "../../common/errors.js";
import {
  buildPaginatedResult,
  paginationArgs,
  type PaginatedResult,
} from "../../common/pagination.js";
// Reusing the Course module's public repository API (Phase 6-adjacent, not
// touched here) rather than re-querying courses ad hoc.
import * as courseRepository from "../course/course.repository.js";
// Reusing the booking engine's audit helper and action vocabulary so bulk
// approve/reject show up in the same RESERVATION_APPROVED/REJECTED trail as
// single-reservation actions — reservation.service.ts itself is not modified.
import { recordReservationAuditEvent } from "../reservation/reservation.audit.js";
import type {
  BulkApproveReservationsInput,
  BulkRejectReservationsInput,
  ListFacultyCoursesQuery,
  WeeklyScheduleQuery,
} from "./faculty.dto.js";
import * as facultyRepository from "./faculty.repository.js";
import type { ReservationWithNode } from "./faculty.repository.js";
import { priorityOf, sortByPriority, type ReservationPriority } from "./priorityQueue.js";
import { endOfWeekUTC, startOfWeekUTC } from "./week.js";

export type FacultyServiceDb = Pick<
  PrismaClient,
  "user" | "reservation" | "gpuNode" | "course" | "auditLog"
> & {
  $transaction: PrismaClient["$transaction"];
};

/**
 * The subset of the client needed inside an already-open `$transaction`
 * callback. Deliberately excludes `$transaction` itself — Prisma's
 * interactive-transaction client (`tx`) has no such method (nested
 * transactions aren't supported), so requiring it here would make every
 * call site lie about what `tx` actually offers.
 */
type FacultyTxDb = Pick<PrismaClient, "reservation" | "auditLog">;

const DASHBOARD_PREVIEW_LIMIT = 10;

export interface ReservationSummaryView {
  id: string;
  userId: string;
  courseId: string | null;
  gpuNodeId: string;
  hostname: string;
  laboratoryId: string;
  laboratoryName: string;
  status: ReservationStatus;
  startTime: string;
  endTime: string;
  purpose: string;
  priority: ReservationPriority;
}

function toSummary(reservation: ReservationWithNode): ReservationSummaryView {
  return {
    id: reservation.id,
    userId: reservation.userId,
    courseId: reservation.courseId,
    gpuNodeId: reservation.gpuNodeId,
    hostname: reservation.gpuNode.hostname,
    laboratoryId: reservation.gpuNode.laboratory.id,
    laboratoryName: reservation.gpuNode.laboratory.name,
    status: reservation.status,
    startTime: reservation.startTime.toISOString(),
    endTime: reservation.endTime.toISOString(),
    purpose: reservation.purpose,
    priority: priorityOf(reservation),
  };
}

// ---------------------------------------------------------------------------
// Faculty Dashboard
// ---------------------------------------------------------------------------

export interface FacultyDashboardView {
  pendingApprovals: { total: number; items: ReservationSummaryView[] };
  todaysSessions: ReservationSummaryView[];
  activeGpuUsage: {
    activeReservations: number;
    totalNodes: number;
    activeNodes: number;
    utilizationPercent: number;
  };
  upcomingReservations: ReservationSummaryView[];
}

const EMPTY_DASHBOARD: FacultyDashboardView = {
  pendingApprovals: { total: 0, items: [] },
  todaysSessions: [],
  activeGpuUsage: { activeReservations: 0, totalNodes: 0, activeNodes: 0, utilizationPercent: 0 },
  upcomingReservations: [],
};

export async function getFacultyDashboard(
  db: FacultyServiceDb,
  facultyId: string,
  now: Date = new Date(),
): Promise<FacultyDashboardView> {
  const departmentId = await facultyRepository.findFacultyDepartmentId(db, facultyId);
  if (!departmentId) return EMPTY_DASHBOARD;

  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const [pendingItems, pendingTotal, todaysSessions, activeReservations, totalNodes, upcoming] =
    await Promise.all([
      facultyRepository.listReservationsInDepartment(db, {
        departmentId,
        status: "PENDING",
        take: DASHBOARD_PREVIEW_LIMIT,
      }),
      facultyRepository.countReservationsInDepartment(db, { departmentId, status: "PENDING" }),
      facultyRepository.listReservationsInDepartment(db, {
        departmentId,
        status: ["APPROVED", "ACTIVE"],
        overlapsFrom: dayStart,
        overlapsTo: dayEnd,
      }),
      facultyRepository.listReservationsInDepartment(db, { departmentId, status: "ACTIVE" }),
      facultyRepository.countGpuNodesInDepartment(db, departmentId),
      facultyRepository.listReservationsInDepartment(db, {
        departmentId,
        status: "APPROVED",
        startingFrom: now,
        take: DASHBOARD_PREVIEW_LIMIT,
      }),
    ]);

  const activeNodeIds = new Set(activeReservations.map((r) => r.gpuNodeId));

  return {
    pendingApprovals: {
      total: pendingTotal,
      items: sortByPriority(pendingItems).map(toSummary),
    },
    todaysSessions: todaysSessions.map(toSummary),
    activeGpuUsage: {
      activeReservations: activeReservations.length,
      totalNodes,
      activeNodes: activeNodeIds.size,
      utilizationPercent: totalNodes === 0 ? 0 : Math.round((activeNodeIds.size / totalNodes) * 100),
    },
    upcomingReservations: upcoming.map(toSummary),
  };
}

// ---------------------------------------------------------------------------
// Course Workspace
// ---------------------------------------------------------------------------

export interface FacultyCourseSummaryView {
  id: string;
  courseCode: string;
  courseName: string;
  semester: string;
  pendingReservations: number;
  approvedReservations: number;
  activeReservations: number;
}

export async function listFacultyCourses(
  db: FacultyServiceDb,
  facultyId: string,
  query: ListFacultyCoursesQuery,
): Promise<PaginatedResult<FacultyCourseSummaryView>> {
  const { skip, take } = paginationArgs(query);
  const [items, total] = await Promise.all([
    courseRepository.listCourses(db, { facultyId, skip, take }),
    courseRepository.countCourses(db, { facultyId }),
  ]);

  const counts = await facultyRepository.countReservationsByCourseAndStatus(
    db,
    items.map((course) => course.id),
  );

  const withCounts = items.map((course): FacultyCourseSummaryView => {
    const courseCounts = counts.get(course.id) ?? {};
    return {
      id: course.id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      semester: course.semester,
      pendingReservations: courseCounts.PENDING ?? 0,
      approvedReservations: courseCounts.APPROVED ?? 0,
      activeReservations: courseCounts.ACTIVE ?? 0,
    };
  });

  return buildPaginatedResult(withCounts, total, query);
}

// ---------------------------------------------------------------------------
// Weekly Lab Schedule
// ---------------------------------------------------------------------------

export interface WeeklyLabScheduleView {
  weekStart: string;
  weekEnd: string;
  laboratories: {
    laboratoryId: string;
    laboratoryName: string;
    reservations: ReservationSummaryView[];
  }[];
}

export async function getWeeklyLabSchedule(
  db: FacultyServiceDb,
  facultyId: string,
  query: WeeklyScheduleQuery,
): Promise<WeeklyLabScheduleView> {
  const weekStart = startOfWeekUTC(query.weekOf ?? new Date());
  const weekEnd = endOfWeekUTC(weekStart);

  const departmentId = await facultyRepository.findFacultyDepartmentId(db, facultyId);
  if (!departmentId) {
    return { weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString(), laboratories: [] };
  }

  const reservations = await facultyRepository.listReservationsInDepartment(db, {
    departmentId,
    overlapsFrom: weekStart,
    overlapsTo: weekEnd,
  });

  const byLab = new Map<
    string,
    { laboratoryId: string; laboratoryName: string; reservations: ReservationSummaryView[] }
  >();
  // `reservations` already comes back startTime-ascending (repository default
  // orderBy), so each lab's bucket stays chronologically ordered as we group.
  for (const reservation of reservations) {
    const lab = reservation.gpuNode.laboratory;
    if (!byLab.has(lab.id)) {
      byLab.set(lab.id, { laboratoryId: lab.id, laboratoryName: lab.name, reservations: [] });
    }
    byLab.get(lab.id)!.reservations.push(toSummary(reservation));
  }

  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    laboratories: Array.from(byLab.values()).sort((a, b) =>
      a.laboratoryName.localeCompare(b.laboratoryName),
    ),
  };
}

// ---------------------------------------------------------------------------
// Bulk Reservation Approval / Rejection
// ---------------------------------------------------------------------------

async function requireFacultyDepartmentId(db: FacultyServiceDb, facultyId: string): Promise<string> {
  const departmentId = await facultyRepository.findFacultyDepartmentId(db, facultyId);
  if (!departmentId) throw forbiddenError("Faculty account has no department assigned");
  return departmentId;
}

/**
 * Bulk approval/rejection share everything except the target status and the
 * audit action, so the per-reservation validate-then-transition step lives
 * once here. Runs inside the caller's `db.$transaction` callback (`tx`),
 * which is what actually delivers the "all or nothing" guarantee: throwing
 * partway through — 404, wrong department, wrong status — aborts the whole
 * transaction, so a failure on reservation #7 of 10 leaves the first six
 * untouched rather than partially applied.
 */
async function transitionReservationInTransaction(
  tx: FacultyTxDb,
  actorId: string,
  departmentId: string,
  reservationId: string,
  targetStatus: Extract<ReservationStatus, "APPROVED" | "REJECTED">,
  metadata?: Record<string, unknown>,
): Promise<Reservation> {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    include: { gpuNode: { include: { laboratory: true } } },
  });
  if (!reservation) throw notFoundError("Reservation", reservationId);
  if (reservation.gpuNode.laboratory.departmentId !== departmentId) {
    throw forbiddenError(`Reservation "${reservationId}" is outside your department`);
  }
  if (reservation.status !== "PENDING") {
    throw conflictError(
      `Reservation "${reservationId}" cannot be ${targetStatus === "APPROVED" ? "approved" : "rejected"} from status "${reservation.status}"`,
    );
  }

  const updated = await tx.reservation.update({
    where: { id: reservationId },
    data: { status: targetStatus },
  });

  await recordReservationAuditEvent(tx, {
    actorId,
    action: targetStatus === "APPROVED" ? "RESERVATION_APPROVED" : "RESERVATION_REJECTED",
    resourceId: reservationId,
    metadata,
  });

  return updated;
}

export async function bulkApproveReservations(
  db: FacultyServiceDb,
  actorId: string,
  input: BulkApproveReservationsInput,
): Promise<Reservation[]> {
  const departmentId = await requireFacultyDepartmentId(db, actorId);

  return db.$transaction(async (tx) => {
    const updated: Reservation[] = [];
    for (const reservationId of input.reservationIds) {
      updated.push(
        await transitionReservationInTransaction(tx, actorId, departmentId, reservationId, "APPROVED", {
          bulk: true,
        }),
      );
    }
    return updated;
  });
}

export async function bulkRejectReservations(
  db: FacultyServiceDb,
  actorId: string,
  input: BulkRejectReservationsInput,
): Promise<Reservation[]> {
  const departmentId = await requireFacultyDepartmentId(db, actorId);

  return db.$transaction(async (tx) => {
    const updated: Reservation[] = [];
    for (const reservationId of input.reservationIds) {
      updated.push(
        await transitionReservationInTransaction(tx, actorId, departmentId, reservationId, "REJECTED", {
          bulk: true,
          reason: input.reason,
        }),
      );
    }
    return updated;
  });
}
