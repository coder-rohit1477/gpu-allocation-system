import { describe, expect, it } from "vitest";
import { endOfWeekUTC, startOfWeekUTC } from "../week.js";

describe("startOfWeekUTC", () => {
  it("returns the same Monday 00:00Z for every day in that week", () => {
    const expectedMonday = new Date("2026-08-17T00:00:00.000Z"); // a Monday

    expect(startOfWeekUTC(new Date("2026-08-17T23:59:59.999Z"))).toEqual(expectedMonday);
    expect(startOfWeekUTC(new Date("2026-08-19T12:00:00.000Z"))).toEqual(expectedMonday);
    expect(startOfWeekUTC(new Date("2026-08-23T00:00:00.000Z"))).toEqual(expectedMonday); // Sunday
  });

  it("rolls Sunday back to the preceding Monday, not forward", () => {
    expect(startOfWeekUTC(new Date("2026-08-23T08:00:00.000Z"))).toEqual(
      new Date("2026-08-17T00:00:00.000Z"),
    );
  });
});

describe("endOfWeekUTC", () => {
  it("is exactly 7 days after weekStart", () => {
    const weekStart = new Date("2026-08-17T00:00:00.000Z");
    expect(endOfWeekUTC(weekStart)).toEqual(new Date("2026-08-24T00:00:00.000Z"));
  });
});
