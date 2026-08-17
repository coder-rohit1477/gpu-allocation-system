import type { PrismaClient } from "@prisma/client";
import { notFoundError } from "../../common/errors.js";
// Reusing Phase 4's GPU node repository functions (hostname lookup, updating
// `lastHeartbeat`) — using the admin module's public API, not modifying it.
import { findGpuNodeByHostname, updateGpuNode } from "../gpuNode/gpuNode.repository.js";
import { computeConnectivityStatus, getHealthSnapshot, listHealthSnapshots } from "./health.service.js";
import type { ConnectivityStatus } from "./health.service.js";
import { getActiveMaintenanceWindow, getActiveMaintenanceWindowsFor } from "./maintenance.service.js";
import { publishGpuHealthEvent, type Publisher } from "./publishGpuEvent.js";
import * as telemetryRepository from "./telemetry.repository.js";
import type { TelemetryPayload } from "./telemetry.dto.js";

export type TelemetryServiceDb = Pick<
  PrismaClient,
  "gpuNode" | "gpuHealthSnapshot" | "gpuMetric" | "maintenanceWindow"
>;

export interface IngestResult {
  gpuNodeId: string;
  hostname: string;
  connectivityStatus: ConnectivityStatus;
}

/**
 * Shared by both POST /telemetry/heartbeat and POST /telemetry/metrics —
 * both persist identically (upsert the current snapshot, append a
 * historical metric row, refresh GpuNode.lastHeartbeat, publish a Redis
 * event). Receiving telemetry at all is itself proof of liveness, so
 * either endpoint counts as a heartbeat; agents may still prefer to call
 * them at different cadences for their own log/rate-limit reasons.
 */
export async function ingestTelemetry(
  db: TelemetryServiceDb,
  publisher: Publisher,
  payload: TelemetryPayload,
): Promise<IngestResult> {
  const node = await findGpuNodeByHostname(db, payload.hostname);
  if (!node) throw notFoundError("GPU node with hostname", payload.hostname);

  await telemetryRepository.upsertHealthSnapshot(db, node.id, payload);
  await telemetryRepository.createMetric(db, node.id, payload);
  await updateGpuNode(db, node.id, { lastHeartbeat: payload.timestamp });

  const connectivityStatus = computeConnectivityStatus(payload.timestamp);

  await publishGpuHealthEvent(publisher, {
    gpuNodeId: node.id,
    hostname: node.hostname,
    status: connectivityStatus,
    gpuUtilization: payload.gpuUtilization,
    memoryUsedGB: payload.memoryUsedGB,
    temperature: payload.temperature,
    powerDraw: payload.powerDraw,
    activeProcesses: payload.activeProcesses,
    lastHeartbeat: payload.timestamp.toISOString(),
  });

  return { gpuNodeId: node.id, hostname: node.hostname, connectivityStatus };
}

export interface NodeMetricsView {
  gpuUtilization: number;
  memoryUsedGB: number;
  temperature: number;
  powerDraw: number;
  activeProcesses: number;
}

export interface NodeHealthView {
  gpuNodeId: string;
  hostname: string;
  /** Raw heartbeat-recency status, ignoring maintenance. */
  connectivityStatus: ConnectivityStatus;
  /** connectivityStatus, unless an active maintenance window overrides it. */
  status: ConnectivityStatus | "MAINTENANCE";
  lastHeartbeat: string | null;
  underMaintenance: boolean;
  metrics: NodeMetricsView | null;
}

function toMetricsView(snapshot: { gpuUtilization: number; memoryUsedGB: number; temperature: number; powerDraw: number; activeProcesses: number } | null): NodeMetricsView | null {
  if (!snapshot) return null;
  return {
    gpuUtilization: snapshot.gpuUtilization,
    memoryUsedGB: snapshot.memoryUsedGB,
    temperature: snapshot.temperature,
    powerDraw: snapshot.powerDraw,
    activeProcesses: snapshot.activeProcesses,
  };
}

export async function getNodeHealth(
  db: TelemetryServiceDb,
  gpuNodeId: string,
  now: Date = new Date(),
): Promise<NodeHealthView> {
  const node = await db.gpuNode.findUnique({ where: { id: gpuNodeId } });
  if (!node) throw notFoundError("GPU node", gpuNodeId);

  const [snapshot, activeMaintenance] = await Promise.all([
    getHealthSnapshot(db, gpuNodeId),
    getActiveMaintenanceWindow(db, gpuNodeId, now),
  ]);

  const lastHeartbeat = snapshot?.lastHeartbeat ?? node.lastHeartbeat;
  const connectivityStatus = computeConnectivityStatus(lastHeartbeat, now);

  return {
    gpuNodeId: node.id,
    hostname: node.hostname,
    connectivityStatus,
    status: activeMaintenance ? "MAINTENANCE" : connectivityStatus,
    lastHeartbeat: lastHeartbeat ? lastHeartbeat.toISOString() : null,
    underMaintenance: Boolean(activeMaintenance),
    metrics: toMetricsView(snapshot),
  };
}

export async function listLiveNodes(
  db: TelemetryServiceDb,
  filters: { labId?: string } = {},
  now: Date = new Date(),
): Promise<NodeHealthView[]> {
  const nodes = await db.gpuNode.findMany({
    where: filters.labId ? { labId: filters.labId } : undefined,
    orderBy: { hostname: "asc" },
  });
  const nodeIds = nodes.map((node) => node.id);

  const [snapshots, activeMaintenanceWindows] = await Promise.all([
    listHealthSnapshots(db, nodeIds),
    getActiveMaintenanceWindowsFor(db, nodeIds, now),
  ]);

  const snapshotByNodeId = new Map(snapshots.map((snapshot) => [snapshot.gpuNodeId, snapshot]));
  const maintenanceNodeIds = new Set(activeMaintenanceWindows.map((window) => window.gpuNodeId));

  return nodes.map((node) => {
    const snapshot = snapshotByNodeId.get(node.id) ?? null;
    const lastHeartbeat = snapshot?.lastHeartbeat ?? node.lastHeartbeat;
    const connectivityStatus = computeConnectivityStatus(lastHeartbeat, now);
    const underMaintenance = maintenanceNodeIds.has(node.id);

    return {
      gpuNodeId: node.id,
      hostname: node.hostname,
      connectivityStatus,
      status: underMaintenance ? "MAINTENANCE" : connectivityStatus,
      lastHeartbeat: lastHeartbeat ? lastHeartbeat.toISOString() : null,
      underMaintenance,
      metrics: toMetricsView(snapshot),
    };
  });
}
