-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'LAB_ADMIN', 'FACULTY', 'STUDENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "LabStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "GpuStatus" AS ENUM ('AVAILABLE', 'BUSY', 'MAINTENANCE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('RUNNING', 'COMPLETED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laboratories" (
    "id" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "floor" TEXT NOT NULL,
    "status" "LabStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "laboratories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "universityId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "departmentId" UUID,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "courseCode" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "facultyId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpu_nodes" (
    "id" UUID NOT NULL,
    "labId" UUID NOT NULL,
    "hostname" TEXT NOT NULL,
    "gpuModel" TEXT NOT NULL,
    "gpuCount" INTEGER NOT NULL,
    "totalMemoryGB" INTEGER NOT NULL,
    "cpuCores" INTEGER NOT NULL,
    "ramGB" INTEGER NOT NULL,
    "status" "GpuStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastHeartbeat" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gpu_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "gpuNodeId" UUID NOT NULL,
    "courseId" UUID,
    "startTime" TIMESTAMPTZ(6) NOT NULL,
    "endTime" TIMESTAMPTZ(6) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "purpose" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_sessions" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ(6) NOT NULL,
    "endedAt" TIMESTAMPTZ(6),
    "computeHours" DECIMAL(10,2),
    "status" "SessionStatus" NOT NULL DEFAULT 'RUNNING',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "allocation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_windows" (
    "id" UUID NOT NULL,
    "gpuNodeId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMPTZ(6) NOT NULL,
    "endTime" TIMESTAMPTZ(6) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "maintenance_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE INDEX "departments_organizationId_idx" ON "departments"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_organizationId_code_key" ON "departments"("organizationId", "code");

-- CreateIndex
CREATE INDEX "laboratories_departmentId_idx" ON "laboratories"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "laboratories_departmentId_name_key" ON "laboratories"("departmentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "users_universityId_key" ON "users"("universityId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_departmentId_idx" ON "users"("departmentId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "courses_courseCode_key" ON "courses"("courseCode");

-- CreateIndex
CREATE INDEX "courses_facultyId_idx" ON "courses"("facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "gpu_nodes_hostname_key" ON "gpu_nodes"("hostname");

-- CreateIndex
CREATE INDEX "gpu_nodes_labId_idx" ON "gpu_nodes"("labId");

-- CreateIndex
CREATE INDEX "gpu_nodes_status_idx" ON "gpu_nodes"("status");

-- CreateIndex
CREATE INDEX "reservations_userId_idx" ON "reservations"("userId");

-- CreateIndex
CREATE INDEX "reservations_gpuNodeId_idx" ON "reservations"("gpuNodeId");

-- CreateIndex
CREATE INDEX "reservations_courseId_idx" ON "reservations"("courseId");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

-- CreateIndex
CREATE INDEX "reservations_gpuNodeId_startTime_endTime_idx" ON "reservations"("gpuNodeId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "allocation_sessions_reservationId_idx" ON "allocation_sessions"("reservationId");

-- CreateIndex
CREATE INDEX "allocation_sessions_status_idx" ON "allocation_sessions"("status");

-- CreateIndex
CREATE INDEX "maintenance_windows_gpuNodeId_idx" ON "maintenance_windows"("gpuNodeId");

-- CreateIndex
CREATE INDEX "maintenance_windows_status_idx" ON "maintenance_windows"("status");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laboratories" ADD CONSTRAINT "laboratories_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gpu_nodes" ADD CONSTRAINT "gpu_nodes_labId_fkey" FOREIGN KEY ("labId") REFERENCES "laboratories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_gpuNodeId_fkey" FOREIGN KEY ("gpuNodeId") REFERENCES "gpu_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_sessions" ADD CONSTRAINT "allocation_sessions_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_windows" ADD CONSTRAINT "maintenance_windows_gpuNodeId_fkey" FOREIGN KEY ("gpuNodeId") REFERENCES "gpu_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
