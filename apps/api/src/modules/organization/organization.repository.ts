import type { Organization, Prisma, PrismaClient } from "@prisma/client";

export type OrganizationDb = Pick<PrismaClient, "organization">;

function searchWhere(search?: string): Prisma.OrganizationWhereInput {
  if (!search) return {};
  return {
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ],
  };
}

export async function findOrganizationById(
  db: OrganizationDb,
  id: string,
): Promise<Organization | null> {
  return db.organization.findUnique({ where: { id } });
}

export async function findOrganizationByCode(
  db: OrganizationDb,
  code: string,
): Promise<Organization | null> {
  return db.organization.findUnique({ where: { code } });
}

export async function listOrganizations(
  db: OrganizationDb,
  args: { skip: number; take: number; search?: string },
): Promise<Organization[]> {
  return db.organization.findMany({
    where: searchWhere(args.search),
    skip: args.skip,
    take: args.take,
    orderBy: { name: "asc" },
  });
}

export async function countOrganizations(
  db: OrganizationDb,
  args: { search?: string },
): Promise<number> {
  return db.organization.count({ where: searchWhere(args.search) });
}

export async function createOrganization(
  db: OrganizationDb,
  data: Prisma.OrganizationCreateInput,
): Promise<Organization> {
  return db.organization.create({ data });
}

export async function updateOrganization(
  db: OrganizationDb,
  id: string,
  data: Prisma.OrganizationUpdateInput,
): Promise<Organization> {
  return db.organization.update({ where: { id }, data });
}
