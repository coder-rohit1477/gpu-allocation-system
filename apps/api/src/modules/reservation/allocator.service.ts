/**
 * Smart GPU Allocator — pure selection logic, no I/O, so it can be unit
 * tested directly with plain objects (see __tests__/allocator.test.ts).
 * The caller (reservation.service.ts) is responsible for narrowing
 * `candidates` down to nodes that are already ONLINE and conflict-free for
 * the requested window; this function only decides *which* of those
 * remaining nodes is the best fit.
 */

export interface AllocationCandidate {
  id: string;
  gpuCount: number;
  totalMemoryGB: number;
}

export interface AllocationRequirements {
  minGpuCount: number;
  minMemoryGB: number;
}

/**
 * Best-fit, not first-fit: among candidates that satisfy the requirement,
 * picks the smallest (by gpuCount, then totalMemoryGB) rather than the
 * first one found — this conserves larger nodes for jobs that actually
 * need them instead of exhausting big hardware on small requests.
 */
export function selectBestFitNode<T extends AllocationCandidate>(
  candidates: T[],
  requirements: AllocationRequirements,
): T | null {
  const eligible = candidates.filter(
    (node) =>
      node.gpuCount >= requirements.minGpuCount && node.totalMemoryGB >= requirements.minMemoryGB,
  );

  if (eligible.length === 0) return null;

  return eligible.reduce((best, node) => {
    if (node.gpuCount !== best.gpuCount) return node.gpuCount < best.gpuCount ? node : best;
    return node.totalMemoryGB < best.totalMemoryGB ? node : best;
  });
}
