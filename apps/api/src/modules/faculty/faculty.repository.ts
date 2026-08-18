import type { Prisma, PrismaClient, ReservationStatus } from "@prisma/client";

export type FacultyDb = Pick<PrismaClient, "user" | "reservation" | "gpuNode">;

const RESERVATION_WITH_NODE_INCLUDE = {
  gpuNode: { include: { laboratory: true } },
} satisfies Prisma.ReservationInclude;

export type ReservationWithNode = Prisma.ReservationGetPayload<{
  include: typeof RESERVATION_WITH_NODE_INCLUDE;
}>;

export async function findFacultyDepartmentId(
  db: Pick<PrismaClient, "user">,
  facultyId: string,
): Promise<string | null> {
  const faculty = await db.user.findUnique({ where: { id: facultyId } });
  return faculty?.departmentId ?? null;
}

interface ListInDepartmentArgs {
  departmentId: string;
  status?: ReservationStatus | ReservationStatus[];
  /** Reservations starting at or after this instant. */
  startingFrom?: Date;
  /** Reservations whose [startTime, endTime) window overlaps [overlapsFrom, overlapsTo). */
  overlapsFrom?: Date;
  overlapsTo?: Date;
  take?: number;
  orderBy?: "asc" | "desc";
}

function statusFilter(
  status: ReservationStatus | ReservationStatus[] | undefined,
): Prisma.ReservationWhereInput["status"] {
  if (!status) return undefined;
  return Array.isArray(status) ? { in: status } : status;
}

/**
 * A reservation's "department" is the department that owns the laboratory
 * housing its GPU node — the same scoping rule reservation.routes.ts
 * already applies to single-reservation approve/reject (see
 * reservationDepartmentId there), reused here for every faculty-facing list.
 */
export async function listReservationsInDepartment(
  db: FacultyDb,
  args: ListInDepartmentArgs,
): Promise<ReservationWithNode[]> {
  const where: Prisma.ReservationWhereInput = {
    gpuNode: { laboratory: { departmentId: args.departmentId } },
    status: statusFilter(args.status),
  };
  if (args.startingFrom) {
    where.startTime = { gte: args.startingFrom };
  }
  if (args.overlapsFrom && args.overlapsTo) {
    where.startTime = { lt: args.overlapsTo };
    where.endTime = { gt: args.overlapsFrom };
  }

  return db.reservation.findMany({
    where,
    include: RESERVATION_WITH_NODE_INCLUDE,
    orderBy: { startTime: args.orderBy ?? "asc" },
    take: args.take,
  });
}

export async function countReservationsInDepartment(
  db: FacultyDb,
  args: { departmentId: string; status?: ReservationStatus | ReservationStatus[] },
): Promise<number> {
  return db.reservation.count({
    where: {
      gpuNode: { laboratory: { departmentId: args.departmentId } },
      status: statusFilter(args.status),
    },
  });
}

export async function countGpuNodesInDepartment(
  db: Pick<PrismaClient, "gpuNode">,
  departmentId: string,
): Promise<number> {
  return db.gpuNode.count({ where: { laboratory: { departmentId } } });
}

/**
 * Per-course reservation counts by status, for the Course Workspace view.
 * `courseId` is nullable on Reservation (a booking need not belong to a
 * course), so rows with a null courseId — which can never match `in:
 * courseIds` anyway — are filtered defensively rather than assumed away.
 */
export async function countReservationsByCourseAndStatus(
  db: Pick<PrismaClient, "reservation">,
  courseIds: string[],
): Promise<Map<string, Partial<Record<ReservationStatus, number>>>> {
  const result = new Map<string, Partial<Record<ReservationStatus, number>>>();
  if (courseIds.length === 0) return result;

  const grouped = await db.reservation.groupBy({
    by: ["courseId", "status"],
    where: { courseId: { in: courseIds } },
    _count: { _all: true },
  });

  for (const row of grouped) {
    if (!row.courseId) continue;
    const entry = result.get(row.courseId) ?? {};
    entry[row.status] = row._count._all;
    result.set(row.courseId, entry);
  }
  return result;
}
