import type { Course, Prisma, PrismaClient } from "@prisma/client";

export type CourseDb = Pick<PrismaClient, "course">;

interface CourseFilters {
  search?: string;
  facultyId?: string;
  semester?: string;
}

function whereFrom(args: CourseFilters): Prisma.CourseWhereInput {
  const where: Prisma.CourseWhereInput = {};
  if (args.facultyId) where.facultyId = args.facultyId;
  if (args.semester) where.semester = args.semester;
  if (args.search) {
    where.OR = [
      { courseCode: { contains: args.search, mode: "insensitive" } },
      { courseName: { contains: args.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function findCourseById(db: CourseDb, id: string): Promise<Course | null> {
  return db.course.findUnique({ where: { id } });
}

export async function findCourseByCode(db: CourseDb, courseCode: string): Promise<Course | null> {
  return db.course.findUnique({ where: { courseCode } });
}

export async function listCourses(
  db: CourseDb,
  args: CourseFilters & { skip: number; take: number },
): Promise<Course[]> {
  return db.course.findMany({
    where: whereFrom(args),
    skip: args.skip,
    take: args.take,
    orderBy: { courseCode: "asc" },
  });
}

export async function countCourses(db: CourseDb, args: CourseFilters): Promise<number> {
  return db.course.count({ where: whereFrom(args) });
}

export async function createCourse(db: CourseDb, data: Prisma.CourseCreateInput): Promise<Course> {
  return db.course.create({ data });
}

export async function updateCourse(
  db: CourseDb,
  id: string,
  data: Prisma.CourseUpdateInput,
): Promise<Course> {
  return db.course.update({ where: { id }, data });
}

export async function deleteCourse(db: CourseDb, id: string): Promise<void> {
  await db.course.delete({ where: { id } });
}
