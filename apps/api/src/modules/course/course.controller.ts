import type { Request, Response } from "express";
import { ok, requireParam } from "../../common/http.js";
import { prisma } from "../../lib/prisma.js";
import * as courseService from "./course.service.js";
import { createCourseSchema, listCoursesQuerySchema, updateCourseSchema } from "./course.dto.js";

export async function listCoursesHandler(req: Request, res: Response): Promise<void> {
  const query = listCoursesQuerySchema.parse(req.query);
  const result = await courseService.listCourses(prisma, query);
  ok(res, result);
}

export async function getCourseHandler(req: Request, res: Response): Promise<void> {
  const course = await courseService.getCourse(prisma, requireParam(req, "id"));
  ok(res, course);
}

export async function createCourseHandler(req: Request, res: Response): Promise<void> {
  const input = createCourseSchema.parse(req.body);
  const course = await courseService.createCourse(prisma, req.user!.id, input);
  ok(res, course, 201);
}

export async function updateCourseHandler(req: Request, res: Response): Promise<void> {
  const input = updateCourseSchema.parse(req.body);
  const course = await courseService.updateCourse(
    prisma,
    req.user!.id,
    requireParam(req, "id"),
    input,
  );
  ok(res, course);
}

export async function deleteCourseHandler(req: Request, res: Response): Promise<void> {
  await courseService.deleteCourse(prisma, req.user!.id, requireParam(req, "id"));
  ok(res, { deleted: true });
}
