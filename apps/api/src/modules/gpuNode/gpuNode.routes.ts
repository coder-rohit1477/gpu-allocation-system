import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { requireDepartmentScope } from "../../common/requireDepartmentScope.js";
import { controllerHandler, requireParam } from "../../common/http.js";
import { prisma } from "../../lib/prisma.js";
import {
  changeGpuNodeStatusHandler,
  createGpuNodeHandler,
  deleteGpuNodeHandler,
  getGpuNodeHandler,
  listGpuNodesHandler,
  updateGpuNodeHandler,
  updateGpuNodeHeartbeatHandler,
} from "./gpuNode.controller.js";
import { findGpuNodeById } from "./gpuNode.repository.js";

const router: ExpressRouter = Router();

const ANY_AUTHENTICATED_ROLE = [
  "SUPER_ADMIN",
  "DEPARTMENT_ADMIN",
  "LAB_ADMIN",
  "FACULTY",
  "STUDENT",
] as const;

// Lab Admin, Department Admin, and Super Admin all administer GPU inventory
// per the Phase 4 spec; scoping below still confines Lab/Department Admins
// to their own department's labs (SUPER_ADMIN bypasses scoping entirely).
const GPU_NODE_ADMIN_ROLES = ["SUPER_ADMIN", "DEPARTMENT_ADMIN", "LAB_ADMIN"] as const;

async function labDepartmentId(labId: string | undefined): Promise<string | null> {
  if (!labId) return null;
  const laboratory = await prisma.laboratory.findUnique({ where: { id: labId } });
  return laboratory?.departmentId ?? null;
}

async function nodeDepartmentId(nodeId: string): Promise<string | null> {
  const node = await findGpuNodeById(prisma, nodeId);
  if (!node) return null;
  return labDepartmentId(node.labId);
}

router.use(authenticate);

router.get("/", requireRole(...ANY_AUTHENTICATED_ROLE), controllerHandler(listGpuNodesHandler));
router.get("/:id", requireRole(...ANY_AUTHENTICATED_ROLE), controllerHandler(getGpuNodeHandler));

router.post(
  "/",
  requireRole(...GPU_NODE_ADMIN_ROLES),
  requireDepartmentScope(prisma, (req) => labDepartmentId((req.body as { labId?: string }).labId), {
    bypassRoles: ["SUPER_ADMIN"],
  }),
  controllerHandler(createGpuNodeHandler),
);

router.patch(
  "/:id",
  requireRole(...GPU_NODE_ADMIN_ROLES),
  requireDepartmentScope(prisma, (req) => nodeDepartmentId(requireParam(req, "id")), {
    bypassRoles: ["SUPER_ADMIN"],
  }),
  controllerHandler(updateGpuNodeHandler),
);

router.patch(
  "/:id/status",
  requireRole(...GPU_NODE_ADMIN_ROLES),
  requireDepartmentScope(prisma, (req) => nodeDepartmentId(requireParam(req, "id")), {
    bypassRoles: ["SUPER_ADMIN"],
  }),
  controllerHandler(changeGpuNodeStatusHandler),
);

// Manual heartbeat override — still "admin endpoint only" (no STUDENT/FACULTY),
// scoped the same way as the other Lab Admin GPU node actions.
router.patch(
  "/:id/heartbeat",
  requireRole(...GPU_NODE_ADMIN_ROLES),
  requireDepartmentScope(prisma, (req) => nodeDepartmentId(requireParam(req, "id")), {
    bypassRoles: ["SUPER_ADMIN"],
  }),
  controllerHandler(updateGpuNodeHeartbeatHandler),
);

router.delete(
  "/:id",
  requireRole("SUPER_ADMIN", "DEPARTMENT_ADMIN"),
  requireDepartmentScope(prisma, (req) => nodeDepartmentId(requireParam(req, "id")), {
    bypassRoles: ["SUPER_ADMIN"],
  }),
  controllerHandler(deleteGpuNodeHandler),
);

export default router;
