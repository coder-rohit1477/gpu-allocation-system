import type { Course, Department, GpuNode, PrismaClient, ReservationStatus } from "@prisma/client";
import { ReservationStatus as ReservationStatusEnum } from "@prisma/client";
// Reusing Phase 5's telemetry health helpers — the same source of truth
// listPendingReservationsForFaculty/reservation.service.ts already reuse —
// via their public API, not modifying telemetry itself.
import { computeConnectivityStatus, listHealthSnapshots } from "../telemetry/health.service.js";
import type { ConnectivityStatus } from "../telemetry/health.service.js";

export type AnalyticsDb = Pick<
  PrismaClient,
  | "organization"
  | "department"
  | "laboratory"
  | "gpuNode"
  | "user"
  | "course"
  | "reservation"
  | "allocationSession"
  | "gpuHealthSnapshot"
  | "gpuMetric"
>;

/** Every ReservationStatus mapped to 0 — the base every status breakdown starts from, so a status with zero rows still appears in the response. */
export function zeroedStatusRecord(): Record<ReservationStatus, number> {
  const record = {} as Record<ReservationStatus, number>;
  for (const status of Object.values(ReservationStatusEnum)) record[status] = 0;
  return record;
}

export async function getInstitutionCounts(db: AnalyticsDb): Promise<{
  organizations: number;
  departments: number;
  laboratories: number;
  gpuNodes: number;
  users: number;
  students: number;
  faculty: number;
  courses: number;
}> {
  const [organizations, departments, laboratories, gpuNodes, users, students, faculty, courses] =
    await Promise.all([
      db.organization.count(),
      db.department.count(),
      db.laboratory.count(),
      db.gpuNode.count(),
      db.user.count(),
      db.user.count({ where: { role: "STUDENT" } }),
      db.user.count({ where: { role: "FACULTY" } }),
      db.course.count(),
    ]);
  return { organizations, departments, laboratories, gpuNodes, users, students, faculty, courses };
}

export interface NodeConnectivityRow {
  node: GpuNode;
  connectivityStatus: ConnectivityStatus;
}

/**
 * Connectivity status for every node matching `where`, computed in bulk
 * (one query for the nodes, one for their snapshots) rather than the N+1 a
 * per-node telemetryService.getNodeHealth() call would cost — the dataset
 * here can be every GPU node in the institution, not just one lab.
 */
export async function listNodeConnectivity(
  db: AnalyticsDb,
  where: { labId?: string; departmentId?: string } = {},
  now: Date = new Date(),
): Promise<NodeConnectivityRow[]> {
  const nodes = await db.gpuNode.findMany({
    where: {
      labId: where.labId,
      laboratory: where.departmentId ? { departmentId: where.departmentId } : undefined,
    },
    orderBy: { hostname: "asc" },
  });
  const snapshots = await listHealthSnapshots(db, nodes.map((n) => n.id));
  const snapshotByNode = new Map(snapshots.map((s) => [s.gpuNodeId, s]));

  return nodes.map((node) => {
    const lastHeartbeat = snapshotByNode.get(node.id)?.lastHeartbeat ?? node.lastHeartbeat;
    return { node, connectivityStatus: computeConnectivityStatus(lastHeartbeat, now) };
  });
}

export async function getReservationStatusBreakdown(
  db: AnalyticsDb,
  where: { departmentId?: string; createdFrom?: Date; createdTo?: Date } = {},
): Promise<Record<ReservationStatus, number>> {
  const groups = await db.reservation.groupBy({
    by: ["status"],
    where: {
      gpuNode: where.departmentId ? { laboratory: { departmentId: where.departmentId } } : undefined,
      createdAt:
        where.createdFrom || where.createdTo
          ? { gte: where.createdFrom, lt: where.createdTo }
          : undefined,
    },
    _count: { _all: true },
  });
  const breakdown = zeroedStatusRecord();
  for (const group of groups) breakdown[group.status] = group._count._all;
  return breakdown;
}

export async function getTotalComputeHours(
  db: AnalyticsDb,
  where: { departmentId?: string; endedFrom?: Date; endedTo?: Date } = {},
): Promise<number> {
  const result = await db.allocationSession.aggregate({
    _sum: { computeHours: true },
    where: {
      reservation: where.departmentId
        ? { gpuNode: { laboratory: { departmentId: where.departmentId } } }
        : undefined,
      endedAt: where.endedFrom || where.endedTo ? { gte: where.endedFrom, lt: where.endedTo } : undefined,
    },
  });
  return Number(result._sum.computeHours ?? 0);
}

export async function countActiveReservationsInDepartment(
  db: AnalyticsDb,
  departmentId: string,
): Promise<number> {
  return db.reservation.count({
    where: { status: "ACTIVE", gpuNode: { laboratory: { departmentId } } },
  });
}

export async function listDepartmentsWithLabCounts(
  db: AnalyticsDb,
): Promise<(Department & { laboratoryCount: number; gpuNodeCount: number })[]> {
  const [departments, laboratories, gpuNodes] = await Promise.all([
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.laboratory.findMany({ select: { id: true, departmentId: true } }),
    db.gpuNode.findMany({ select: { id: true, laboratory: { select: { departmentId: true } } } }),
  ]);

  const labCountByDept = new Map<string, number>();
  for (const lab of laboratories) labCountByDept.set(lab.departmentId, (labCountByDept.get(lab.departmentId) ?? 0) + 1);

  const nodeCountByDept = new Map<string, number>();
  for (const node of gpuNodes) {
    const deptId = node.laboratory.departmentId;
    nodeCountByDept.set(deptId, (nodeCountByDept.get(deptId) ?? 0) + 1);
  }

  return departments.map((dept) => ({
    ...dept,
    laboratoryCount: labCountByDept.get(dept.id) ?? 0,
    gpuNodeCount: nodeCountByDept.get(dept.id) ?? 0,
  }));
}

export async function countUsersInDepartment(
  db: AnalyticsDb,
  departmentId: string,
  role: "STUDENT" | "FACULTY",
): Promise<number> {
  return db.user.count({ where: { departmentId, role } });
}

export async function countReservationsInDepartment(db: AnalyticsDb, departmentId: string): Promise<number> {
  return db.reservation.count({ where: { gpuNode: { laboratory: { departmentId } } } });
}

export async function listStudentIdsWithReservations(db: AnalyticsDb): Promise<Set<string>> {
  const rows = await db.reservation.findMany({
    where: { user: { role: "STUDENT" } },
    select: { userId: true },
    distinct: ["userId"],
  });
  return new Set(rows.map((r) => r.userId));
}

export async function listCoursesForAnalytics(db: AnalyticsDb): Promise<Course[]> {
  return db.course.findMany({ orderBy: { courseCode: "asc" } });
}

export async function getCourseReservationStats(
  db: AnalyticsDb,
  courseId: string,
): Promise<{ totalReservations: number; activeReservations: number; totalComputeHours: number }> {
  const [totalReservations, activeReservations, computeAgg] = await Promise.all([
    db.reservation.count({ where: { courseId } }),
    db.reservation.count({ where: { courseId, status: "ACTIVE" } }),
    db.allocationSession.aggregate({ _sum: { computeHours: true }, where: { reservation: { courseId } } }),
  ]);
  return {
    totalReservations,
    activeReservations,
    totalComputeHours: Number(computeAgg._sum.computeHours ?? 0),
  };
}

export interface ReportBucketRaw {
  reservationsCreated: number;
  reservationsByStatus: Record<ReservationStatus, number>;
  totalComputeHours: number;
}

export async function computeReportBucket(
  db: AnalyticsDb,
  range: { start: Date; end: Date },
): Promise<ReportBucketRaw> {
  const [reservationsCreated, statusGroups, computeAgg] = await Promise.all([
    db.reservation.count({ where: { createdAt: { gte: range.start, lt: range.end } } }),
    db.reservation.groupBy({
      by: ["status"],
      where: { createdAt: { gte: range.start, lt: range.end } },
      _count: { _all: true },
    }),
    db.allocationSession.aggregate({
      _sum: { computeHours: true },
      where: { endedAt: { gte: range.start, lt: range.end } },
    }),
  ]);

  const reservationsByStatus = zeroedStatusRecord();
  for (const group of statusGroups) reservationsByStatus[group.status] = group._count._all;

  return {
    reservationsCreated,
    reservationsByStatus,
    totalComputeHours: Number(computeAgg._sum.computeHours ?? 0),
  };
}
