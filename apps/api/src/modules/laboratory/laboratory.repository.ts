import type { Laboratory, LabStatus, Prisma, PrismaClient } from "@prisma/client";

export type LaboratoryDb = Pick<PrismaClient, "laboratory">;

interface LaboratoryFilters {
  search?: string;
  departmentId?: string;
  status?: LabStatus;
}

function whereFrom(args: LaboratoryFilters): Prisma.LaboratoryWhereInput {
  const where: Prisma.LaboratoryWhereInput = {};
  if (args.departmentId) where.departmentId = args.departmentId;
  if (args.status) where.status = args.status;
  if (args.search) {
    where.OR = [
      { name: { contains: args.search, mode: "insensitive" } },
      { location: { contains: args.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function findLaboratoryById(db: LaboratoryDb, id: string): Promise<Laboratory | null> {
  return db.laboratory.findUnique({ where: { id } });
}

export async function findLaboratoryByDeptAndName(
  db: LaboratoryDb,
  departmentId: string,
  name: string,
): Promise<Laboratory | null> {
  return db.laboratory.findUnique({ where: { departmentId_name: { departmentId, name } } });
}

export async function listLaboratories(
  db: LaboratoryDb,
  args: LaboratoryFilters & { skip: number; take: number },
): Promise<Laboratory[]> {
  return db.laboratory.findMany({
    where: whereFrom(args),
    skip: args.skip,
    take: args.take,
    orderBy: { name: "asc" },
  });
}

export async function countLaboratories(
  db: LaboratoryDb,
  args: LaboratoryFilters,
): Promise<number> {
  return db.laboratory.count({ where: whereFrom(args) });
}

export async function createLaboratory(
  db: LaboratoryDb,
  data: Prisma.LaboratoryCreateInput,
): Promise<Laboratory> {
  return db.laboratory.create({ data });
}

export async function updateLaboratory(
  db: LaboratoryDb,
  id: string,
  data: Prisma.LaboratoryUpdateInput,
): Promise<Laboratory> {
  return db.laboratory.update({ where: { id }, data });
}

export async function deleteLaboratory(db: LaboratoryDb, id: string): Promise<void> {
  await db.laboratory.delete({ where: { id } });
}
