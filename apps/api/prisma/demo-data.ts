/**
 * DEV/DEMO-ONLY data generator — NOT part of production seeding.
 *
 * prisma/seed.ts creates the university's static structure (org,
 * departments, labs, courses, users, GPU node inventory) but deliberately
 * no reservation activity. Combined with every GPU node starting OFFLINE
 * (no heartbeat has ever been sent), a fresh seed has nothing for a
 * student to book or a faculty member to approve.
 *
 * This script closes that gap for a local demo by:
 *   1. Sending one real telemetry heartbeat (via the same
 *      telemetryService.ingestTelemetry the HTTP ingestion endpoints and
 *      the demo-telemetry-simulator container both call) so a known
 *      seeded GPU node is genuinely ONLINE by heartbeat-recency — not by
 *      writing a status column directly.
 *   2. Creating one PENDING reservation via reservationService.
 *      createReservation — the same booking logic the real API uses,
 *      including the "must be ONLINE" and conflict checks — so the
 *      resulting reservation is indistinguishable from one a student
 *      created through the UI.
 *
 * Idempotent: reruns detect the reservation created by a previous run (via
 * a fixed purpose-string marker) and skip creating a duplicate.
 *
 * Requires prisma/seed.ts to have already run — see README's "Demo
 * environment" section for the full sequence.
 */
import { prisma } from "../src/lib/prisma.js";
import { redis } from "../src/lib/redis.js";
import * as telemetryService from "../src/modules/telemetry/telemetry.service.js";
import * as reservationService from "../src/modules/reservation/reservation.service.js";
import type { TelemetryPayload } from "../src/modules/telemetry/telemetry.dto.js";

// A known seeded node (see seed.ts: CSE dept, first of its 4 nodes) —
// fixed rather than "pick any node" so reruns are predictable and the
// printed instructions below always describe the actual state created.
const DEMO_GPU_HOSTNAME = "cse-gpu-node-01.muj.local";
const DEMO_STUDENT_UNIVERSITY_ID = "MUJ-STU-0001";
const DEMO_COURSE_CODE = "CSE401";
const DEMO_FACULTY_UNIVERSITY_ID = "MUJ-FAC-0001";

// Marks reservations this script created so reruns can detect and skip
// them, and so they're obviously not something a real student typed.
const DEMO_PURPOSE_MARKER = "[DEMO]";
const DEMO_RESERVATION_PURPOSE =
  `${DEMO_PURPOSE_MARKER} Training run for coursework demo — created by prisma/demo-data.ts`;

function emailFor(universityId: string): string {
  return `${universityId.toLowerCase()}@muj.manipal.edu`;
}

async function ensureNodeOnline(hostname: string): Promise<string> {
  const node = await prisma.gpuNode.findUnique({ where: { hostname } });
  if (!node) {
    throw new Error(
      `GPU node "${hostname}" not found — run "pnpm --filter @gpu/api run prisma:seed" first.`,
    );
  }

  const payload: TelemetryPayload = {
    hostname,
    gpuUtilization: 38,
    memoryUsedGB: 22,
    temperature: 61,
    powerDraw: 240,
    activeProcesses: 3,
    timestamp: new Date(),
  };

  const result = await telemetryService.ingestTelemetry(prisma, redis, payload);
  console.log(`  GPU node "${hostname}" is now ${result.connectivityStatus} (via real telemetry ingestion)`);
  return node.id;
}

async function main(): Promise<void> {
  console.log("Generating demo reservation activity (DEV/DEMO only)...");

  const gpuNodeId = await ensureNodeOnline(DEMO_GPU_HOSTNAME);

  const student = await prisma.user.findUnique({
    where: { email: emailFor(DEMO_STUDENT_UNIVERSITY_ID) },
  });
  if (!student) {
    throw new Error(`Demo student "${DEMO_STUDENT_UNIVERSITY_ID}" not found — run the seed script first.`);
  }

  const course = await prisma.course.findUnique({ where: { courseCode: DEMO_COURSE_CODE } });
  if (!course) {
    throw new Error(`Demo course "${DEMO_COURSE_CODE}" not found — run the seed script first.`);
  }

  const existing = await prisma.reservation.findFirst({
    where: { userId: student.id, gpuNodeId, purpose: DEMO_RESERVATION_PURPOSE },
  });

  if (existing) {
    console.log(`  Demo reservation already exists (id=${existing.id}, status=${existing.status}) — skipping.`);
  } else {
    const now = Date.now();
    const startTime = new Date(now + 60 * 60 * 1000); // +1h — always valid at run time
    const endTime = new Date(now + 3 * 60 * 60 * 1000); // +3h

    const reservation = await reservationService.createReservation(prisma, student.id, {
      gpuNodeId,
      courseId: course.id,
      startTime,
      endTime,
      purpose: DEMO_RESERVATION_PURPOSE,
    });

    console.log(`  Created PENDING reservation id=${reservation.id} on "${DEMO_GPU_HOSTNAME}"`);
  }

  console.log("\nDemo data ready:");
  console.log(`  Log in as student:  ${emailFor(DEMO_STUDENT_UNIVERSITY_ID)}`);
  console.log(`  Log in as faculty:  ${emailFor(DEMO_FACULTY_UNIVERSITY_ID)} (or any CSE faculty account)`);
  console.log("  Every seeded account's password: ChangeMe123! (dev only)");
  console.log(
    "  Faculty > Approvals will show the pending reservation; approving it updates status for the student too.",
  );
}

main()
  .catch((error: unknown) => {
    console.error("Demo data generation failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
