import { describe, expect, it } from "vitest";
import { priorityOf, sortByPriority } from "../priorityQueue.js";

function reservation(courseId: string | null, startTime: string) {
  return { courseId, startTime: new Date(startTime) };
}

describe("priorityOf", () => {
  it("classifies a reservation tied to a course as COURSEWORK", () => {
    expect(priorityOf({ courseId: "course-1" })).toBe("COURSEWORK");
  });

  it("classifies a reservation with no course as RESEARCH", () => {
    expect(priorityOf({ courseId: null })).toBe("RESEARCH");
  });
});

describe("sortByPriority", () => {
  it("orders COURSEWORK reservations ahead of RESEARCH ones", () => {
    const research = reservation(null, "2026-01-01T10:00:00Z");
    const coursework = reservation("course-1", "2026-01-01T12:00:00Z");

    const sorted = sortByPriority([research, coursework]);
    expect(sorted).toEqual([coursework, research]);
  });

  it("breaks ties within the same priority tier by startTime ascending", () => {
    const later = reservation("course-1", "2026-01-01T12:00:00Z");
    const earlier = reservation("course-1", "2026-01-01T09:00:00Z");

    const sorted = sortByPriority([later, earlier]);
    expect(sorted).toEqual([earlier, later]);
  });

  it("does not mutate the input array", () => {
    const items = [reservation(null, "2026-01-01T10:00:00Z"), reservation("course-1", "2026-01-01T09:00:00Z")];
    const original = [...items];
    sortByPriority(items);
    expect(items).toEqual(original);
  });
});
