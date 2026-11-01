import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, filterByRange, mergeRows, paramStatus, summarize, thresholdBreaches, type SheetReading } from "./rules";

const r = (row: number, timestamp: string, ph = 7, tds = 200, temperature = 25): SheetReading => ({ row, timestamp, ph, tds, temperature });

describe("aqua rules", () => {
  it("default ideal range is pH 6.5–8.5, TDS ≤ 500, suhu 15–35", () => {
    expect(paramStatus("ph", 6.4, DEFAULT_SETTINGS)).toBe("WASPADA");
    expect(paramStatus("ph", 8.5, DEFAULT_SETTINGS)).toBe("NORMAL");
    expect(paramStatus("tds", 501, DEFAULT_SETTINGS)).toBe("WASPADA");
    expect(paramStatus("temperature", 36, DEFAULT_SETTINGS)).toBe("WASPADA");
  });
  it("lists every breached threshold", () => {
    expect(thresholdBreaches({ ph: 9, tds: 600, temperature: 25, timestamp: "" }, DEFAULT_SETTINGS)).toHaveLength(2);
  });
  it("date filter keeps only rows inside the chosen range (inclusive)", () => {
    const rows = [r(2, "2026-01-01T00:00:00.000Z"), r(3, "2026-01-02T00:00:00.000Z"), r(4, "2026-01-03T00:00:00.000Z")];
    expect(filterByRange(rows, "2026-01-02T00:00:00.000Z", "2026-01-03T00:00:00.000Z").map((x) => x.row)).toEqual([3, 4]);
  });
  it("report has no numbers when no data remains (no fake values)", () => {
    expect(summarize([])).toEqual({ count: 0, ph: null, tds: null, temperature: null });
  });
  it("report min/max/avg come from remaining rows", () => {
    const s = summarize([r(2, "2026-01-01T00:00:00Z", 6), r(3, "2026-01-01T00:01:00Z", 8)]);
    expect(s.ph).toEqual({ min: 6, max: 8, avg: 7 });
  });
  it("loading new pages never duplicates a sheet row", () => {
    const a = [r(2, "2026-01-01T00:00:00Z")];
    expect(mergeRows(a, [r(2, "2026-01-01T00:00:00Z"), r(3, "2026-01-01T00:01:00Z")])).toHaveLength(2);
  });
});
