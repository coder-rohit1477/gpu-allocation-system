import type { GpuNode, GpuStatus, Prisma, PrismaClient } from "@prisma/client";

export type GpuNodeDb = Pick<PrismaClient, "gpuNode">;

interface GpuNodeFilters {
  search?: string;
  labId?: string;
  status?: GpuStatus;
}

function whereFrom(args: GpuNodeFilters): Prisma.GpuNodeWhereInput {
  const where: Prisma.GpuNodeWhereInput = {};
  if (args.labId) where.labId = args.labId;
  if (args.status) where.status = args.status;
  if (args.search) {
    where.OR = [
      { hostname: { contains: args.search, mode: "insensitive" } },
      { gpuModel: { contains: args.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function findGpuNodeById(db: GpuNodeDb, id: string): Promise<GpuNode | null> {
  return db.gpuNode.findUnique({ where: { id } });
}

export async function findGpuNodeByHostname(
  db: GpuNodeDb,
  hostname: string,
): Promise<GpuNode | null> {
  return db.gpuNode.findUnique({ where: { hostname } });
}

export async function listGpuNodes(
  db: GpuNodeDb,
  args: GpuNodeFilters & { skip: number; take: number },
): Promise<GpuNode[]> {
  return db.gpuNode.findMany({
    where: whereFrom(args),
    skip: args.skip,
    take: args.take,
    orderBy: { hostname: "asc" },
  });
}

export async function countGpuNodes(db: GpuNodeDb, args: GpuNodeFilters): Promise<number> {
  return db.gpuNode.count({ where: whereFrom(args) });
}

export async function createGpuNode(
  db: GpuNodeDb,
  data: Prisma.GpuNodeCreateInput,
): Promise<GpuNode> {
  return db.gpuNode.create({ data });
}

export async function updateGpuNode(
  db: GpuNodeDb,
  id: string,
  data: Prisma.GpuNodeUpdateInput,
): Promise<GpuNode> {
  return db.gpuNode.update({ where: { id }, data });
}

export async function deleteGpuNode(db: GpuNodeDb, id: string): Promise<void> {
  await db.gpuNode.delete({ where: { id } });
}
