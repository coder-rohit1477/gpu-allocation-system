import { useMemo, useState } from "react";
import { Button, Card, EmptyState, Skeleton } from "@gpu/ui";
import type { GpuNode, GpuNodeAvailability, Laboratory } from "@gpu/types";
import { apiClient } from "../api/client.js";
import { useApi } from "../hooks/useApi.js";
import { useDebouncedValue } from "../hooks/useDebouncedValue.js";
import { AsyncSection } from "../components/AsyncSection.js";
import { PageHeader } from "../components/PageHeader.js";
import { ConnectivityBadge } from "../components/StatusBadge.js";
import { ReserveGpuModal } from "../components/ReserveGpuModal.js";

function GpuCardSkeleton() {
  return (
    <div className="gpu-grid">
      {Array.from({ length: 6 }, (_, i) => (
        <Card key={i}>
          <Skeleton height="1.25rem" width="60%" />
          <Skeleton height="1rem" width="40%" />
          <Skeleton height="1rem" width="80%" />
        </Card>
      ))}
    </div>
  );
}

export function GpuExplorerPage() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [departmentId, setDepartmentId] = useState("");
  const [labId, setLabId] = useState("");
  const [reservingNode, setReservingNode] = useState<GpuNode | null>(null);

  const laboratories = useApi(() => apiClient.laboratories.list({ pageSize: 100 }), []);
  const departments = useApi(() => apiClient.departments.list({ pageSize: 100 }), []);

  const nodes = useApi(
    () => apiClient.gpuNodes.list({ search: search || undefined, labId: labId || undefined, pageSize: 100 }),
    [search, labId],
  );
  const availability = useApi(
    () => apiClient.gpuNodes.availability(labId ? { labId } : undefined),
    [labId],
  );

  const availabilityByNode = useMemo(() => {
    const map = new Map<string, GpuNodeAvailability>();
    for (const item of availability.data?.items ?? []) map.set(item.gpuNodeId, item);
    return map;
  }, [availability.data]);

  const labsById = useMemo(() => {
    const map = new Map<string, Laboratory>();
    for (const lab of laboratories.data?.items ?? []) map.set(lab.id, lab);
    return map;
  }, [laboratories.data]);

  const visibleLabs = useMemo(
    () => (laboratories.data?.items ?? []).filter((lab) => !departmentId || lab.departmentId === departmentId),
    [laboratories.data, departmentId],
  );

  const filteredNodes = useMemo(() => {
    const items = nodes.data?.items ?? [];
    if (!departmentId) return items;
    return items.filter((node) => labsById.get(node.labId)?.departmentId === departmentId);
  }, [nodes.data, departmentId, labsById]);

  const loading = nodes.loading || availability.loading;
  const error = nodes.error ?? availability.error;

  return (
    <div className="page">
      <PageHeader title="GPU Explorer" description="Browse live GPU nodes and reserve one for your work." />

      <Card className="filter-bar">
        <label className="form__field form__field--inline">
          <span>Search</span>
          <input
            type="search"
            placeholder="Hostname or GPU model…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </label>

        <label className="form__field form__field--inline">
          <span>Department</span>
          <select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setLabId("");
            }}
          >
            <option value="">All departments</option>
            {departments.data?.items.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </label>

        <label className="form__field form__field--inline">
          <span>Laboratory</span>
          <select value={labId} onChange={(e) => setLabId(e.target.value)}>
            <option value="">All laboratories</option>
            {visibleLabs.map((lab) => (
              <option key={lab.id} value={lab.id}>
                {lab.name}
              </option>
            ))}
          </select>
        </label>
      </Card>

      <AsyncSection
        loading={loading}
        error={error}
        onRetry={() => {
          nodes.reload();
          availability.reload();
        }}
        isEmpty={filteredNodes.length === 0}
        emptyState={
          <EmptyState
            title="No GPUs match your filters"
            description="Try clearing the search or filters above."
          />
        }
        skeleton={<GpuCardSkeleton />}
      >
        <div className="gpu-grid">
          {filteredNodes.map((node) => {
            const live = availabilityByNode.get(node.id);
            const connectivity = live?.connectivityStatus ?? "OFFLINE";
            const lab = labsById.get(node.labId);
            return (
              <Card key={node.id} className="gpu-card">
                <div className="gpu-card__header">
                  <h3>{node.hostname}</h3>
                  <ConnectivityBadge status={connectivity} />
                </div>
                <p className="gpu-card__model">{node.gpuModel}</p>
                <dl className="gpu-card__specs">
                  <div>
                    <dt>GPUs</dt>
                    <dd>{node.gpuCount}</dd>
                  </div>
                  <div>
                    <dt>Memory</dt>
                    <dd>{node.totalMemoryGB} GB</dd>
                  </div>
                  <div>
                    <dt>Laboratory</dt>
                    <dd>{lab?.name ?? "—"}</dd>
                  </div>
                </dl>
                <Button
                  onClick={() => setReservingNode(node)}
                  disabled={connectivity !== "ONLINE" || live?.available === false}
                >
                  {connectivity !== "ONLINE" ? "Unavailable" : "Reserve"}
                </Button>
              </Card>
            );
          })}
        </div>
      </AsyncSection>

      {reservingNode && (
        <ReserveGpuModal
          node={reservingNode}
          onClose={() => setReservingNode(null)}
          onReserved={() => nodes.reload()}
        />
      )}
    </div>
  );
}
