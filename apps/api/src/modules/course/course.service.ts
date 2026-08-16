import type { Course, PrismaClient } from "@prisma/client";
import { recordAdminAuditEvent } from "../../common/audit.js";
import { badRequestError, conflictError, notFoundError } from "../../common/errors.js";
import {
  buildPaginatedResult,
  paginationArgs,
  type PaginatedResult,
} from "../../common/pagination.js";
import { isUniqueConstraintError } from "../../common/prismaErrors.js";
import * as courseRepository from "./course.repository.js";
import type { CreateCourseInput, ListCoursesQuery, UpdateCourseInput } from "./course.dto.js";

export type CourseServiceDb = Pick<PrismaClient, "course" | "user" | "auditLog">;

async function assertFaculty(db: CourseServiceDb, facultyId: string): Promise<void> {
  const faculty = await db.user.findUnique({ where: { id: facultyId } });
  if (!faculty) throw badRequestError(`User "${facultyId}" does not exist`);
  if (faculty.role !== "FACULTY") {
    throw badRequestError(`User "${facultyId}" is not a FACULTY member and cannot own a course`);
  }
}

export async function listCourses(
  db: CourseServiceDb,
  query: ListCoursesQuery,
): Promise<PaginatedResult<Course>> {
  const { skip, take } = paginationArgs(query);
  const filters = { search: query.search, facultyId: query.facultyId, semester: query.semester };
  const [items, total] = await Promise.all([
    courseRepository.listCourses(db, { skip, take, ...filters }),
    courseRepository.countCourses(db, filters),
  ]);
  return buildPaginatedResult(items, total, query);
}

export async function getCourse(db: CourseServiceDb, id: string): Promise<Course> {
  const course = await courseRepository.findCourseById(db, id);
  if (!course) throw notFoundError("Course", id);
  return course;
}

export async function createCourse(
  db: CourseServiceDb,
  actorId: string,
  input: CreateCourseInput,
): Promise<Course> {
  await assertFaculty(db, input.facultyId);

  const existing = await courseRepository.findCourseByCode(db, input.courseCode);
  if (existing) throw conflictError(`Course code "${input.courseCode}" is already in use`);

  let course: Course;
  try {
    course = await courseRepository.createCourse(db, {
      courseCode: input.courseCode,
      courseName: input.courseName,
      semester: input.semester,
      faculty: { connect: { id: input.facultyId } },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflictError(`Course code "${input.courseCode}" is already in use`);
    }
    throw error;
  }

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_COURSE_CREATED",
    resourceType: "Course",
    resourceId: course.id,
    metadata: { courseCode: course.courseCode, facultyId: course.facultyId },
  });

  return course;
}

export async function updateCourse(
  db: CourseServiceDb,
  actorId: string,
  id: string,
  input: UpdateCourseInput,
): Promise<Course> {
  await getCourse(db, id);

  if (input.facultyId) {
    await assertFaculty(db, input.facultyId);
  }

  const course = await courseRepository.updateCourse(db, id, {
    courseName: input.courseName,
    semester: input.semester,
    faculty: input.facultyId ? { connect: { id: input.facultyId } } : undefined,
  });

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_COURSE_UPDATED",
    resourceType: "Course",
    resourceId: course.id,
    metadata: { changes: input },
  });

  return course;
}

export async function deleteCourse(
  db: CourseServiceDb,
  actorId: string,
  id: string,
): Promise<void> {
  await getCourse(db, id);
  await courseRepository.deleteCourse(db, id);

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_COURSE_DELETED",
    resourceType: "Course",
    resourceId: id,
  });
}
