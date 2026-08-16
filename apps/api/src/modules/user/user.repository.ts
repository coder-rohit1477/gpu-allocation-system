import type { Prisma, PrismaClient, User, UserRole, UserStatus } from "@prisma/client";

export type UserDb = Pick<PrismaClient, "user">;

interface UserFilters {
  search?: string;
  role?: UserRole;
  departmentId?: string;
  status?: UserStatus;
}

function whereFrom(args: UserFilters): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};
  if (args.role) where.role = args.role;
  if (args.departmentId) where.departmentId = args.departmentId;
  if (args.status) where.status = args.status;
  if (args.search) {
    where.OR = [
      { fullName: { contains: args.search, mode: "insensitive" } },
      { email: { contains: args.search, mode: "insensitive" } },
      { universityId: { contains: args.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function findUserById(db: UserDb, id: string): Promise<User | null> {
  return db.user.findUnique({ where: { id } });
}

export async function findUserByEmail(db: UserDb, email: string): Promise<User | null> {
  return db.user.findUnique({ where: { email } });
}

export async function findUserByUniversityId(
  db: UserDb,
  universityId: string,
): Promise<User | null> {
  return db.user.findUnique({ where: { universityId } });
}

export async function listUsers(
  db: UserDb,
  args: UserFilters & { skip: number; take: number },
): Promise<User[]> {
  return db.user.findMany({
    where: whereFrom(args),
    skip: args.skip,
    take: args.take,
    orderBy: { fullName: "asc" },
  });
}

export async function countUsers(db: UserDb, args: UserFilters): Promise<number> {
  return db.user.count({ where: whereFrom(args) });
}

export async function createUser(db: UserDb, data: Prisma.UserCreateInput): Promise<User> {
  return db.user.create({ data });
}

// Unchecked, not Prisma.UserUpdateInput: callers pass the raw `departmentId`
// scalar directly (e.g. assignUserDepartment) rather than a nested
// `department: { connect / disconnect }` relation object.
export async function updateUser(
  db: UserDb,
  id: string,
  data: Prisma.UserUncheckedUpdateInput,
): Promise<User> {
  return db.user.update({ where: { id }, data });
}
