import type { GpuNode, PrismaClient } from "@prisma/client";
import { recordAdminAuditEvent } from "../../common/audit.js";
import { badRequestError, conflictError, notFoundError } from "../../common/errors.js";
import {
  buildPaginatedResult,
  paginationArgs,
  type PaginatedResult,
} from "../../common/pagination.js";
import { isForeignKeyConstraintError, isUniqueConstraintError } from "../../common/prismaErrors.js";
import * as gpuNodeRepository from "./gpuNode.repository.js";
import type {
  ChangeGpuNodeStatusInput,
  CreateGpuNodeInput,
  ListGpuNodesQuery,
  UpdateGpuNodeHeartbeatInput,
  UpdateGpuNodeInput,
} from "./gpuNode.dto.js";

export type GpuNodeServiceDb = Pick<PrismaClient, "gpuNode" | "laboratory" | "auditLog">;

export async function listGpuNodes(
  db: GpuNodeServiceDb,
  query: ListGpuNodesQuery,
): Promise<PaginatedResult<GpuNode>> {
  const { skip, take } = paginationArgs(query);
  const filters = { search: query.search, labId: query.labId, status: query.status };
  const [items, total] = await Promise.all([
    gpuNodeRepository.listGpuNodes(db, { skip, take, ...filters }),
    gpuNodeRepository.countGpuNodes(db, filters),
  ]);
  return buildPaginatedResult(items, total, query);
}

export async function getGpuNode(db: GpuNodeServiceDb, id: string): Promise<GpuNode> {
  const node = await gpuNodeRepository.findGpuNodeById(db, id);
  if (!node) throw notFoundError("GPU node", id);
  return node;
}

export async function createGpuNode(
  db: GpuNodeServiceDb,
  actorId: string,
  input: CreateGpuNodeInput,
): Promise<GpuNode> {
  const laboratory = await db.laboratory.findUnique({ where: { id: input.labId } });
  if (!laboratory) throw badRequestError(`Laboratory "${input.labId}" does not exist`);

  const existing = await gpuNodeRepository.findGpuNodeByHostname(db, input.hostname);
  if (existing) throw conflictError(`Hostname "${input.hostname}" is already in use`);

  let node: GpuNode;
  try {
    node = await gpuNodeRepository.createGpuNode(db, {
      laboratory: { connect: { id: input.labId } },
      hostname: input.hostname,
      gpuModel: input.gpuModel,
      gpuCount: input.gpuCount,
      totalMemoryGB: input.totalMemoryGB,
      cpuCores: input.cpuCores,
      ramGB: input.ramGB,
      status: input.status,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflictError(`Hostname "${input.hostname}" is already in use`);
    }
    throw error;
  }

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_GPU_NODE_CREATED",
    resourceType: "GpuNode",
    resourceId: node.id,
    metadata: { labId: node.labId, hostname: node.hostname },
  });

  return node;
}

export async function updateGpuNode(
  db: GpuNodeServiceDb,
  actorId: string,
  id: string,
  input: UpdateGpuNodeInput,
): Promise<GpuNode> {
  await getGpuNode(db, id);

  if (input.hostname) {
    const existing = await gpuNodeRepository.findGpuNodeByHostname(db, input.hostname);
    if (existing && existing.id !== id) {
      throw conflictError(`Hostname "${input.hostname}" is already in use`);
    }
  }

  let node: GpuNode;
  try {
    node = await gpuNodeRepository.updateGpuNode(db, id, input);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflictError(`Hostname "${input.hostname}" is already in use`);
    }
    throw error;
  }

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_GPU_NODE_UPDATED",
    resourceType: "GpuNode",
    resourceId: node.id,
    metadata: { changes: input },
  });

  return node;
}

export async function changeGpuNodeStatus(
  db: GpuNodeServiceDb,
  actorId: string,
  id: string,
  input: ChangeGpuNodeStatusInput,
): Promise<GpuNode> {
  const current = await getGpuNode(db, id);
  const node = await gpuNodeRepository.updateGpuNode(db, id, { status: input.status });

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_GPU_NODE_STATUS_CHANGED",
    resourceType: "GpuNode",
    resourceId: node.id,
    metadata: { from: current.status, to: node.status },
  });

  return node;
}

/**
 * Manual admin override for lastHeartbeat. There is no telemetry agent yet
 * (out of scope for this phase) — this exists purely so ops/admins can mark
 * a node's heartbeat by hand, e.g. after confirming it's alive out-of-band.
 */
export async function updateGpuNodeHeartbeat(
  db: GpuNodeServiceDb,
  actorId: string,
  id: string,
  input: UpdateGpuNodeHeartbeatInput,
): Promise<GpuNode> {
  await getGpuNode(db, id);
  const lastHeartbeat = input.lastHeartbeat ?? new Date();
  const node = await gpuNodeRepository.updateGpuNode(db, id, { lastHeartbeat });

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_GPU_NODE_HEARTBEAT_UPDATED",
    resourceType: "GpuNode",
    resourceId: node.id,
    metadata: { lastHeartbeat: lastHeartbeat.toISOString() },
  });

  return node;
}

export async function deleteGpuNode(
  db: GpuNodeServiceDb,
  actorId: string,
  id: string,
): Promise<void> {
  await getGpuNode(db, id);

  try {
    await gpuNodeRepository.deleteGpuNode(db, id);
  } catch (error) {
    if (isForeignKeyConstraintError(error)) {
      throw conflictError(
        "GPU node cannot be deleted while it still has reservations or maintenance records",
      );
    }
    throw error;
  }

  await recordAdminAuditEvent(db, {
    actorId,
    action: "ADMIN_GPU_NODE_DELETED",
    resourceType: "GpuNode",
    resourceId: id,
  });
}
