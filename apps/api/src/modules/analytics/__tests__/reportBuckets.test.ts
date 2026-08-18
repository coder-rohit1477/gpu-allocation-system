import { describe, expect, it } from "vitest";
import { dailyBuckets, monthlyBuckets, parseYearMonth, weeklyBuckets } from "../reportBuckets.js";

describe("dailyBuckets", () => {
  it("returns `count` consecutive UTC day buckets ending on the anchor's day", () => {
    const anchor = new Date("2026-08-18T15:30:00.000Z");
    const buckets = dailyBuckets(anchor, 3);

    expect(buckets).toHaveLength(3);
    expect(buckets[0]).toEqual({
      start: new Date("2026-08-16T00:00:00.000Z"),
      end: new Date("2026-08-17T00:00:00.000Z"),
    });
    expect(buckets[2]).toEqual({
      start: new Date("2026-08-18T00:00:00.000Z"),
      end: new Date("2026-08-19T00:00:00.000Z"),
    });
  });

  it("each bucket is exactly 24 hours wide", () => {
    for (const bucket of dailyBuckets(new Date("2026-08-18T00:00:00.000Z"), 5)) {
      expect(bucket.end.getTime() - bucket.start.getTime()).toBe(86_400_000);
    }
  });
});

describe("weeklyBuckets", () => {
  it("returns `count` consecutive Monday-start weeks ending on the anchor's week", () => {
    const anchor = new Date("2026-08-19T12:00:00.000Z"); // a Wednesday
    const buckets = weeklyBuckets(anchor, 2);

    expect(buckets).toHaveLength(2);
    expect(buckets[1]).toEqual({
      start: new Date("2026-08-17T00:00:00.000Z"), // Monday of anchor's week
      end: new Date("2026-08-24T00:00:00.000Z"),
    });
    expect(buckets[0]).toEqual({
      start: new Date("2026-08-10T00:00:00.000Z"),
      end: new Date("2026-08-17T00:00:00.000Z"),
    });
  });
});

describe("monthlyBuckets", () => {
  it("returns `count` consecutive UTC calendar months ending on the anchor's month", () => {
    const anchor = new Date("2026-08-18T00:00:00.000Z");
    const buckets = monthlyBuckets(anchor, 3);

    expect(buckets).toEqual([
      { start: new Date("2026-06-01T00:00:00.000Z"), end: new Date("2026-07-01T00:00:00.000Z") },
      { start: new Date("2026-07-01T00:00:00.000Z"), end: new Date("2026-08-01T00:00:00.000Z") },
      { start: new Date("2026-08-01T00:00:00.000Z"), end: new Date("2026-09-01T00:00:00.000Z") },
    ]);
  });

  it("handles a year boundary correctly", () => {
    const anchor = new Date("2026-01-15T00:00:00.000Z");
    const buckets = monthlyBuckets(anchor, 2);

    expect(buckets).toEqual([
      { start: new Date("2025-12-01T00:00:00.000Z"), end: new Date("2026-01-01T00:00:00.000Z") },
      { start: new Date("2026-01-01T00:00:00.000Z"), end: new Date("2026-02-01T00:00:00.000Z") },
    ]);
  });
});

describe("parseYearMonth", () => {
  it("parses a valid YYYY-MM string to the first instant of that UTC month", () => {
    expect(parseYearMonth("2026-03")).toEqual(new Date("2026-03-01T00:00:00.000Z"));
  });

  it("returns null for a malformed string", () => {
    expect(parseYearMonth("2026-3")).toBeNull();
    expect(parseYearMonth("not-a-month")).toBeNull();
  });

  it("returns null for an out-of-range month", () => {
    expect(parseYearMonth("2026-13")).toBeNull();
    expect(parseYearMonth("2026-00")).toBeNull();
  });
});
