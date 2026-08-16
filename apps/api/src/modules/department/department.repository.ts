import type { Department, Prisma, PrismaClient } from "@prisma/client";

export type DepartmentDb = Pick<PrismaClient, "department">;

function searchWhere(args: {
  search?: string;
  organizationId?: string;
}): Prisma.DepartmentWhereInput {
  const where: Prisma.DepartmentWhereInput = {};
  if (args.organizationId) where.organizationId = args.organizationId;
  if (args.search) {
    where.OR = [
      { name: { contains: args.search, mode: "insensitive" } },
      { code: { contains: args.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function findDepartmentById(db: DepartmentDb, id: string): Promise<Department | null> {
  return db.department.findUnique({ where: { id } });
}

export async function findDepartmentByOrgAndCode(
  db: DepartmentDb,
  organizationId: string,
  code: string,
): Promise<Department | null> {
  return db.department.findUnique({ where: { organizationId_code: { organizationId, code } } });
}

export async function listDepartments(
  db: DepartmentDb,
  args: { skip: number; take: number; search?: string; organizationId?: string },
): Promise<Department[]> {
  return db.department.findMany({
    where: searchWhere(args),
    skip: args.skip,
    take: args.take,
    orderBy: { name: "asc" },
  });
}

export async function countDepartments(
  db: DepartmentDb,
  args: { search?: string; organizationId?: string },
): Promise<number> {
  return db.department.count({ where: searchWhere(args) });
}

export async function createDepartment(
  db: DepartmentDb,
  data: Prisma.DepartmentCreateInput,
): Promise<Department> {
  return db.department.create({ data });
}

export async function updateDepartment(
  db: DepartmentDb,
  id: string,
  data: Prisma.DepartmentUpdateInput,
): Promise<Department> {
  return db.department.update({ where: { id }, data });
}

export async function deleteDepartment(db: DepartmentDb, id: string): Promise<void> {
  await db.department.delete({ where: { id } });
}
