import {
  PrismaClient,
  UserRole,
  LabStatus,
  GpuStatus,
  type Department,
  type User,
} from "@prisma/client";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

// Fixed seed keeps generated names/faker-derived values stable across reseeds;
// identity fields (universityId, email, code, hostname) are still derived
// deterministically from indices, not from faker, so upserts stay idempotent
// even if the faker version changes what names it produces.
faker.seed(20260816);

const ORGANIZATION = { name: "Manipal University Jaipur", code: "MUJ" } as const;

const DEPARTMENTS = [
  { code: "CSE", name: "Computer Science & Engineering" },
  { code: "AI", name: "Artificial Intelligence" },
  { code: "DS", name: "Data Science" },
] as const;

type DeptCode = (typeof DEPARTMENTS)[number]["code"];

const LABS: Record<DeptCode, { name: string; location: string; floor: string }> = {
  CSE: { name: "High Performance Computing Lab", location: "Block 5, Room 210", floor: "2" },
  AI: { name: "AI Research Lab", location: "Block 5, Room 310", floor: "3" },
  DS: { name: "Deep Learning Lab", location: "Block 5, Room 410", floor: "4" },
};

const FACULTY_COUNTS: Record<DeptCode, number> = { CSE: 4, AI: 3, DS: 3 };
const STUDENT_COUNTS: Record<DeptCode, number> = { CSE: 20, AI: 15, DS: 15 };

const GPU_MODELS = [
  { model: "NVIDIA A100 80GB", memoryGB: 80 },
  { model: "NVIDIA H100 80GB", memoryGB: 80 },
  { model: "NVIDIA RTX 4090", memoryGB: 24 },
  { model: "NVIDIA V100 32GB", memoryGB: 32 },
];

// 12 nodes, 4 per lab: mostly available, with a couple busy/maintenance/offline
// so seeded data exercises every GpuStatus value.
const GPU_STATUS_CYCLE: GpuStatus[] = [
  GpuStatus.AVAILABLE,
  GpuStatus.AVAILABLE,
  GpuStatus.BUSY,
  GpuStatus.MAINTENANCE,
];

const COURSES: Array<{ code: string; name: string; semester: string; deptCode: DeptCode }> = [
  { code: "CSE401", name: "Advanced Operating Systems", semester: "Monsoon 2026", deptCode: "CSE" },
  { code: "CSE402", name: "Distributed Systems", semester: "Monsoon 2026", deptCode: "CSE" },
  { code: "AI501", name: "Deep Learning Foundations", semester: "Monsoon 2026", deptCode: "AI" },
  { code: "AI502", name: "Reinforcement Learning", semester: "Winter 2026", deptCode: "AI" },
  { code: "DS301", name: "Large-Scale Data Engineering", semester: "Winter 2026", deptCode: "DS" },
];

function emailFor(universityId: string): string {
  return `${universityId.toLowerCase()}@muj.manipal.edu`;
}

interface SeedUserInput {
  universityId: string;
  fullName: string;
  role: UserRole;
  departmentId: string | null;
}

async function upsertUser(input: SeedUserInput): Promise<User> {
  const email = emailFor(input.universityId);
  return prisma.user.upsert({
    where: { email },
    update: {
      universityId: input.universityId,
      fullName: input.fullName,
      role: input.role,
      departmentId: input.departmentId,
    },
    create: {
      universityId: input.universityId,
      fullName: input.fullName,
      email,
      role: input.role,
      departmentId: input.departmentId,
    },
  });
}

async function main(): Promise<void> {
  console.log("Seeding Manipal University Jaipur GPU platform data...");

  const organization = await prisma.organization.upsert({
    where: { code: ORGANIZATION.code },
    update: { name: ORGANIZATION.name },
    create: ORGANIZATION,
  });

  const departmentByCode = new Map<DeptCode, Department>();
  for (const dept of DEPARTMENTS) {
    const department = await prisma.department.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: dept.code } },
      update: { name: dept.name },
      create: { organizationId: organization.id, name: dept.name, code: dept.code },
    });
    departmentByCode.set(dept.code, department);
  }

  const labByDeptCode = new Map<DeptCode, { id: string }>();
  for (const dept of DEPARTMENTS) {
    const department = departmentByCode.get(dept.code)!;
    const lab = LABS[dept.code];
    const laboratory = await prisma.laboratory.upsert({
      where: { departmentId_name: { departmentId: department.id, name: lab.name } },
      update: { location: lab.location, floor: lab.floor, status: LabStatus.ACTIVE },
      create: {
        departmentId: department.id,
        name: lab.name,
        location: lab.location,
        floor: lab.floor,
        status: LabStatus.ACTIVE,
      },
    });
    labByDeptCode.set(dept.code, laboratory);
  }

  const superAdmin = await upsertUser({
    universityId: "MUJ-SA-0001",
    fullName: "Ananya Rao",
    role: UserRole.SUPER_ADMIN,
    // Institution-wide role — not scoped to any single department.
    departmentId: null,
  });

  const departmentAdmins: User[] = [];
  for (const [index, dept] of DEPARTMENTS.entries()) {
    const department = departmentByCode.get(dept.code)!;
    const user = await upsertUser({
      universityId: `MUJ-DA-${String(index + 1).padStart(4, "0")}`,
      fullName: faker.person.fullName(),
      role: UserRole.DEPARTMENT_ADMIN,
      departmentId: department.id,
    });
    departmentAdmins.push(user);
  }

  const labAdmins: User[] = [];
  for (const [index, dept] of DEPARTMENTS.entries()) {
    const department = departmentByCode.get(dept.code)!;
    const user = await upsertUser({
      universityId: `MUJ-LA-${String(index + 1).padStart(4, "0")}`,
      fullName: faker.person.fullName(),
      role: UserRole.LAB_ADMIN,
      departmentId: department.id,
    });
    labAdmins.push(user);
  }

  const faculty: User[] = [];
  const facultyByDept = new Map<DeptCode, User[]>();
  let facultySeq = 1;
  for (const dept of DEPARTMENTS) {
    const department = departmentByCode.get(dept.code)!;
    const deptFaculty: User[] = [];
    for (let i = 0; i < FACULTY_COUNTS[dept.code]; i++) {
      const user = await upsertUser({
        universityId: `MUJ-FAC-${String(facultySeq).padStart(4, "0")}`,
        fullName: faker.person.fullName(),
        role: UserRole.FACULTY,
        departmentId: department.id,
      });
      faculty.push(user);
      deptFaculty.push(user);
      facultySeq++;
    }
    facultyByDept.set(dept.code, deptFaculty);
  }

  const students: User[] = [];
  let studentSeq = 1;
  for (const dept of DEPARTMENTS) {
    const department = departmentByCode.get(dept.code)!;
    for (let i = 0; i < STUDENT_COUNTS[dept.code]; i++) {
      const user = await upsertUser({
        universityId: `MUJ-STU-${String(studentSeq).padStart(4, "0")}`,
        fullName: faker.person.fullName(),
        role: UserRole.STUDENT,
        departmentId: department.id,
      });
      students.push(user);
      studentSeq++;
    }
  }

  const courseIndexByDept = new Map<DeptCode, number>();
  for (const course of COURSES) {
    const deptFaculty = facultyByDept.get(course.deptCode)!;
    const nextIndex = courseIndexByDept.get(course.deptCode) ?? 0;
    const facultyMember = deptFaculty[nextIndex % deptFaculty.length]!;
    courseIndexByDept.set(course.deptCode, nextIndex + 1);

    await prisma.course.upsert({
      where: { courseCode: course.code },
      update: {
        courseName: course.name,
        semester: course.semester,
        facultyId: facultyMember.id,
      },
      create: {
        courseCode: course.code,
        courseName: course.name,
        semester: course.semester,
        facultyId: facultyMember.id,
      },
    });
  }

  let gpuSeq = 0;
  for (const dept of DEPARTMENTS) {
    const laboratory = labByDeptCode.get(dept.code)!;
    for (let i = 0; i < 4; i++) {
      const modelInfo = GPU_MODELS[gpuSeq % GPU_MODELS.length]!;
      const status = GPU_STATUS_CYCLE[gpuSeq % GPU_STATUS_CYCLE.length]!;
      const hostname = `${dept.code.toLowerCase()}-gpu-node-${String(i + 1).padStart(2, "0")}.muj.local`;
      const gpuCount = i % 2 === 0 ? 8 : 4;
      const cpuCores = i % 2 === 0 ? 64 : 32;
      const ramGB = i % 2 === 0 ? 512 : 256;
      const lastHeartbeat = status === GpuStatus.OFFLINE ? null : new Date();

      await prisma.gpuNode.upsert({
        where: { hostname },
        update: {
          labId: laboratory.id,
          gpuModel: modelInfo.model,
          gpuCount,
          totalMemoryGB: modelInfo.memoryGB,
          cpuCores,
          ramGB,
          status,
          lastHeartbeat,
        },
        create: {
          labId: laboratory.id,
          hostname,
          gpuModel: modelInfo.model,
          gpuCount,
          totalMemoryGB: modelInfo.memoryGB,
          cpuCores,
          ramGB,
          status,
          lastHeartbeat,
        },
      });
      gpuSeq++;
    }
  }

  const counts = {
    organizations: await prisma.organization.count(),
    departments: await prisma.department.count(),
    laboratories: await prisma.laboratory.count(),
    users: await prisma.user.count(),
    courses: await prisma.course.count(),
    gpuNodes: await prisma.gpuNode.count(),
  };

  console.log("Seed complete:", counts);
  console.log(`  super admin: ${superAdmin.email}`);
  console.log(`  department admins: ${departmentAdmins.length}`);
  console.log(`  lab admins: ${labAdmins.length}`);
  console.log(`  faculty: ${faculty.length}`);
  console.log(`  students: ${students.length}`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
