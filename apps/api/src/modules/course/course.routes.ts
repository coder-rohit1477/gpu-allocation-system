import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { requireDepartmentScope } from "../../common/requireDepartmentScope.js";
import { controllerHandler, requireParam } from "../../common/http.js";
import { prisma } from "../../lib/prisma.js";
import {
  createCourseHandler,
  deleteCourseHandler,
  getCourseHandler,
  listCoursesHandler,
  updateCourseHandler,
} from "./course.controller.js";
import { findCourseById } from "./course.repository.js";

const router: ExpressRouter = Router();

const ANY_AUTHENTICATED_ROLE = [
  "SUPER_ADMIN",
  "DEPARTMENT_ADMIN",
  "LAB_ADMIN",
  "FACULTY",
  "STUDENT",
] as const;

async function facultyDepartmentId(facultyId: string | undefined): Promise<string | null> {
  if (!facultyId) return null;
  const faculty = await prisma.user.findUnique({ where: { id: facultyId } });
  return faculty?.departmentId ?? null;
}

async function courseDepartmentId(courseId: string): Promise<string | null> {
  const course = await findCourseById(prisma, courseId);
  if (!course) return null;
  return facultyDepartmentId(course.facultyId);
}

router.use(authenticate);

router.get("/", requireRole(...ANY_AUTHENTICATED_ROLE), controllerHandler(listCoursesHandler));
router.get("/:id", requireRole(...ANY_AUTHENTICATED_ROLE), controllerHandler(getCourseHandler));

router.post(
  "/",
  requireRole("SUPER_ADMIN", "DEPARTMENT_ADMIN"),
  requireDepartmentScope(
    prisma,
    (req) => facultyDepartmentId((req.body as { facultyId?: string }).facultyId),
    { bypassRoles: ["SUPER_ADMIN"] },
  ),
  controllerHandler(createCourseHandler),
);

router.patch(
  "/:id",
  requireRole("SUPER_ADMIN", "DEPARTMENT_ADMIN"),
  requireDepartmentScope(prisma, (req) => courseDepartmentId(requireParam(req, "id")), {
    bypassRoles: ["SUPER_ADMIN"],
  }),
  controllerHandler(updateCourseHandler),
);

router.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "DEPARTMENT_ADMIN"),
  requireDepartmentScope(prisma, (req) => courseDepartmentId(requireParam(req, "id")), {
    bypassRoles: ["SUPER_ADMIN"],
  }),
  controllerHandler(deleteCourseHandler),
);

export default router;
