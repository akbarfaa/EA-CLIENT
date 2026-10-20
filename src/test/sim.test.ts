import { describe, expect, it } from "vitest";
import { monteCarlo } from "@/lib/sim";

describe("monteCarlo", () => {
  it("all-win path grows by risk*rr per trade", () => {
    const r = monteCarlo({ balance: 1000, riskPct: 1, rr: 2, winRate: 100, trades: 1, costPct: 0, paths: 1 }, () => 0);
    expect(r.p50).toBeCloseTo(1020);
  });
  it("all-loss path counts losing streak", () => {
    const r = monteCarlo({ balance: 1000, riskPct: 1, rr: 2, winRate: 0, trades: 5, costPct: 0, paths: 1 }, () => 0.5);
    expect(r.streak95).toBe(5);
  });
});
