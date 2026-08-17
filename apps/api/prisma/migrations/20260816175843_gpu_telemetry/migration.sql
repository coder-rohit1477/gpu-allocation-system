-- CreateTable
CREATE TABLE "gpu_health_snapshots" (
    "id" UUID NOT NULL,
    "gpuNodeId" UUID NOT NULL,
    "gpuUtilization" DOUBLE PRECISION NOT NULL,
    "memoryUsedGB" DOUBLE PRECISION NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "powerDraw" DOUBLE PRECISION NOT NULL,
    "activeProcesses" INTEGER NOT NULL,
    "lastHeartbeat" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gpu_health_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpu_metrics" (
    "id" UUID NOT NULL,
    "gpuNodeId" UUID NOT NULL,
    "gpuUtilization" DOUBLE PRECISION NOT NULL,
    "memoryUsedGB" DOUBLE PRECISION NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "powerDraw" DOUBLE PRECISION NOT NULL,
    "activeProcesses" INTEGER NOT NULL,
    "recordedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gpu_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gpu_health_snapshots_gpuNodeId_key" ON "gpu_health_snapshots"("gpuNodeId");

-- CreateIndex
CREATE INDEX "gpu_metrics_gpuNodeId_idx" ON "gpu_metrics"("gpuNodeId");

-- CreateIndex
CREATE INDEX "gpu_metrics_gpuNodeId_recordedAt_idx" ON "gpu_metrics"("gpuNodeId", "recordedAt");

-- CreateIndex
CREATE INDEX "gpu_metrics_recordedAt_idx" ON "gpu_metrics"("recordedAt");

-- AddForeignKey
ALTER TABLE "gpu_health_snapshots" ADD CONSTRAINT "gpu_health_snapshots_gpuNodeId_fkey" FOREIGN KEY ("gpuNodeId") REFERENCES "gpu_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gpu_metrics" ADD CONSTRAINT "gpu_metrics_gpuNodeId_fkey" FOREIGN KEY ("gpuNodeId") REFERENCES "gpu_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
