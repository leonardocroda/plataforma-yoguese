import { describe, expect, it } from "vitest";
import { calculateComposition } from "../composition";

describe("composition (domain)", () => {
  it("PRD example: 5 fixed + 2 makeup + 1 experimental fills 8 with 0 spots left", () => {
    expect(
      calculateComposition({
        capacity: 8,
        fixedCount: 5,
        makeupCount: 2,
        experimentalCount: 1,
      }),
    ).toEqual({
      fixedCount: 5,
      makeupCount: 2,
      experimentalCount: 1,
      total: 8,
      availableSpots: 0,
    });
  });

  it("an empty occurrence keeps every spot", () => {
    expect(
      calculateComposition({
        capacity: 8,
        fixedCount: 0,
        makeupCount: 0,
        experimentalCount: 0,
      }),
    ).toEqual({
      fixedCount: 0,
      makeupCount: 0,
      experimentalCount: 0,
      total: 0,
      availableSpots: 8,
    });
  });

  it("an exceeding composition leaves negative spots (RES-22)", () => {
    const result = calculateComposition({
      capacity: 8,
      fixedCount: 5,
      makeupCount: 2,
      experimentalCount: 2,
    });
    expect(result.total).toBe(9);
    expect(result.availableSpots).toBe(-1);
  });

  it("sums each link separately", () => {
    const onlyFixed = calculateComposition({
      capacity: 5,
      fixedCount: 3,
      makeupCount: 0,
      experimentalCount: 0,
    });
    expect(onlyFixed.total).toBe(3);
    expect(onlyFixed.availableSpots).toBe(2);

    const onlyBookings = calculateComposition({
      capacity: 5,
      fixedCount: 0,
      makeupCount: 2,
      experimentalCount: 2,
    });
    expect(onlyBookings.total).toBe(4);
    expect(onlyBookings.availableSpots).toBe(1);
  });
});
