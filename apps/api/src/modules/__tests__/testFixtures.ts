import crypto from "node:crypto";
import request from "supertest";
import type { UserRole } from "@prisma/client";
import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { hashPassword } from "../auth/password.js";

export const app = createApp();

export const TEST_PASSWORD = "Integration-Test-Pass-1!";

/** Unique per test-file run, so reruns never collide on unique constraints. */
export const runId = crypto.randomUUID().slice(0, 8);

export interface RoleUser {
  id: string;
  email: string;
  role: UserRole;
  departmentId: string | null;
  agent: ReturnType<typeof request.agent>;
}

async function createRoleUser(
  role: UserRole,
  departmentId: string | null,
  label: string,
): Promise<RoleUser> {
  const email = `admin-test-${runId}-${label}@muj.manipal.edu`;
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const user = await prisma.user.create({
    data: {
      universityId: `TEST-${runId}-${label}`.toUpperCase(),
      fullName: `Test ${label}`,
      email,
      role,
      departmentId,
      credential: { create: { passwordHash } },
    },
  });

  const agent = request.agent(app);
  const loginRes = await agent.post("/api/v1/auth/login").send({ email, password: TEST_PASSWORD });
  if (loginRes.status !== 200) {
    throw new Error(
      `Fixture login failed for ${email}: ${loginRes.status} ${JSON.stringify(loginRes.body)}`,
    );
  }

  return { id: user.id, email, role, departmentId, agent };
}

export interface AdminTestFixtures {
  organizationId: string;
  departmentAId: string;
  departmentBId: string;
  labAId: string;
  labBId: string;
  superAdmin: RoleUser;
  deptAdminA: RoleUser;
  deptAdminB: RoleUser;
  labAdminA: RoleUser;
  facultyA: RoleUser;
  studentA: RoleUser;
}

export async function buildAdminTestFixtures(): Promise<AdminTestFixtures> {
  const organization = await prisma.organization.create({
    data: { name: `Integration Test Org ${runId}`, code: `TESTORG-${runId}` },
  });

  const departmentA = await prisma.department.create({
    data: { organizationId: organization.id, name: `Dept A ${runId}`, code: `DEPTA-${runId}` },
  });
  const departmentB = await prisma.department.create({
    data: { organizationId: organization.id, name: `Dept B ${runId}`, code: `DEPTB-${runId}` },
  });

  const labA = await prisma.laboratory.create({
    data: {
      departmentId: departmentA.id,
      name: `Lab A ${runId}`,
      location: "Test Block",
      floor: "1",
    },
  });
  const labB = await prisma.laboratory.create({
    data: {
      departmentId: departmentB.id,
      name: `Lab B ${runId}`,
      location: "Test Block",
      floor: "2",
    },
  });

  const superAdmin = await createRoleUser("SUPER_ADMIN", null, "super");
  const deptAdminA = await createRoleUser("DEPARTMENT_ADMIN", departmentA.id, "deptadmin-a");
  const deptAdminB = await createRoleUser("DEPARTMENT_ADMIN", departmentB.id, "deptadmin-b");
  const labAdminA = await createRoleUser("LAB_ADMIN", departmentA.id, "labadmin-a");
  const facultyA = await createRoleUser("FACULTY", departmentA.id, "faculty-a");
  const studentA = await createRoleUser("STUDENT", departmentA.id, "student-a");

  return {
    organizationId: organization.id,
    departmentAId: departmentA.id,
    departmentBId: departmentB.id,
    labAId: labA.id,
    labBId: labB.id,
    superAdmin,
    deptAdminA,
    deptAdminB,
    labAdminA,
    facultyA,
    studentA,
  };
}

export async function cleanupAdminTestFixtures(fixtures: AdminTestFixtures): Promise<void> {
  // Re-query fresh from the DB rather than relying on the static ids
  // captured at fixture-build time: individual tests create extra
  // laboratories/departments (pagination fixtures, RBAC "allowed create"
  // cases) that aren't tracked on the `fixtures` object but still need to
  // be torn down, or the Restrict foreign keys below will block cleanup.
  const departments = await prisma.department.findMany({
    where: { organizationId: fixtures.organizationId },
    select: { id: true },
  });
  const departmentIds = departments.map((d) => d.id);

  const labs = await prisma.laboratory.findMany({
    where: { departmentId: { in: departmentIds } },
    select: { id: true },
  });
  const labIds = labs.map((l) => l.id);

  // Child-to-parent order to respect the schema's Restrict foreign keys.
  await prisma.gpuNode.deleteMany({ where: { labId: { in: labIds } } });
  await prisma.course.deleteMany({ where: { facultyId: fixtures.facultyA.id } });
  await prisma.laboratory.deleteMany({ where: { id: { in: labIds } } });
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [
          fixtures.superAdmin.id,
          fixtures.deptAdminA.id,
          fixtures.deptAdminB.id,
          fixtures.labAdminA.id,
          fixtures.facultyA.id,
          fixtures.studentA.id,
        ],
      },
    },
  });
  await prisma.department.deleteMany({ where: { id: { in: departmentIds } } });
  await prisma.organization.delete({ where: { id: fixtures.organizationId } });
}
