import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@gpu/ui";
import type { GpuNode } from "@gpu/types";
import { apiClient } from "../api/client.js";
import { errorMessage } from "../lib/errors.js";
import { useApi } from "../hooks/useApi.js";
import { Modal } from "./Modal.js";

export interface ReserveGpuModalProps {
  node: Pick<GpuNode, "id" | "hostname" | "gpuModel">;
  onClose: () => void;
  onReserved: () => void;
}

function defaultDateTimeLocal(minutesFromNow: number): string {
  const date = new Date(Date.now() + minutesFromNow * 60_000);
  date.setSeconds(0, 0);
  // <input type="datetime-local"> wants local time with no timezone suffix.
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ReserveGpuModal({ node, onClose, onReserved }: ReserveGpuModalProps) {
  const { data: courses } = useApi(() => apiClient.courses.list({ pageSize: 100 }), []);
  const [startTime, setStartTime] = useState(defaultDateTimeLocal(10));
  const [endTime, setEndTime] = useState(defaultDateTimeLocal(70));
  const [purpose, setPurpose] = useState("");
  const [courseId, setCourseId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.reservations.create({
        gpuNodeId: node.id,
        courseId: courseId || undefined,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        purpose,
      });
      onReserved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Reserve ${node.hostname}`} onClose={onClose}>
      <form className="form" onSubmit={(e) => void handleSubmit(e)}>
        <p className="form__hint">{node.gpuModel}</p>

        <label className="form__field">
          <span>Start time</span>
          <input
            type="datetime-local"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </label>

        <label className="form__field">
          <span>End time</span>
          <input
            type="datetime-local"
            required
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </label>

        <label className="form__field">
          <span>Purpose</span>
          <textarea
            required
            maxLength={500}
            rows={3}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="What will you use this GPU for?"
          />
        </label>

        <label className="form__field">
          <span>Course (optional)</span>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">None — personal/research use</option>
            {courses?.items.map((course) => (
              <option key={course.id} value={course.id}>
                {course.courseCode} — {course.courseName}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}

        <div className="form__actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Reserving…" : "Reserve GPU"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
