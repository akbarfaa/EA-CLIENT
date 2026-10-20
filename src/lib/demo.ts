// SIMULATED demo data — used ONLY when "Demo mode" is enabled, always labelled in the UI.
// Deterministic PRNG so the preview is stable. Not real trading results.
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const reset = () => (seed = 42);
const now = () => Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

export type Health = "healthy" | "delayed" | "stale" | "offline" | "error" | "unknown";

export const demo = {
  summary: () => ({
    accountId: "EXN-DEMO-01", currency: "USD", source: "simulated",
    balance: 10482.36, equity: 10417.9, floating: -64.46, margin: 211.4, freeMargin: 10206.5,
    pnlToday: 38.2, pnlWeek: 142.75, pnlMonth: 482.36, dailyDrawdownPct: 0.92,
    openRisk: null as number | null, openRiskNote: "1 position without SL — not calculable",
    closedTrades: 186, winRate: 0.532, profitFactor: 1.31, expectancy: 2.59, maxDrawdownPct: 6.8,
    lastTelemetry: iso(now() - 14_000),
  }),
  equity: () => {
    reset();
    let b = 10000, e = 10000, peak = 10000;
    return Array.from({ length: 60 }, (_, i) => {
      const d = (rnd() - 0.45) * 60;
      b += d; e = b + (rnd() - 0.5) * 40; peak = Math.max(peak, e);
      return { t: iso(now() - (60 - i) * 86400000).slice(5, 10), balance: +b.toFixed(2), equity: +e.toFixed(2), dd: +(((e - peak) / peak) * 100).toFixed(2), pnl: +d.toFixed(2) };
    });
  },
  byHour: () => { reset(); return Array.from({ length: 24 }, (_, h) => ({ h: `${h}`, pnl: +((rnd() - 0.45) * 80).toFixed(1) })); },
  eas: () => [
    { id: "ea01", name: "EA01", strategy: "Trend Pullback + VWAP", magic: 1001, version: "1.4.2", health: "healthy" as Health, heartbeat: iso(now() - 9000), netPnl: 312.4, floating: -64.46, trades: 92, winRate: 0.55, pf: 1.42, expectancy: 3.4, avgWin: 18.2, avgLoss: -15.6, maxDd: 3.1, avgR: 0.21, longs: 51, shorts: 41, positions: 1, skipped: { spread: 14, news: 6, noSignal: 410, dailyLock: 1 } },
    { id: "ea02", name: "EA02", strategy: "Liquidity Sweep + Reclaim", magic: 1002, version: "0.9.0", health: "delayed" as Health, heartbeat: iso(now() - 95000), netPnl: 141.2, floating: 0, trades: 71, winRate: 0.49, pf: 1.18, expectancy: 1.99, avgWin: 22.1, avgLoss: -18.4, maxDd: 4.8, avgR: 0.08, longs: 30, shorts: 41, positions: 0, skipped: { spread: 22, news: 4, noSignal: 220, rejected: 3 } },
    { id: "ea03", name: "EA03", strategy: "Volatility Expansion / Breakout", magic: 1003, version: "0.3.1", health: "offline" as Health, heartbeat: iso(now() - 3 * 3600000), netPnl: 28.76, floating: 0, trades: 23, winRate: 0.52, pf: 1.09, expectancy: 1.25, avgWin: 25, avgLoss: -24.1, maxDd: 2.2, avgR: 0.04, longs: 12, shorts: 11, positions: 0, skipped: { spread: 5, noSignal: 96, error: 2 } },
  ],
  positions: () => [
    { ticket: 5512031, symbol: "XAUUSDc", side: "BUY", volume: 0.05, entry: 2412.35, price: 2411.06, sl: 2405.1, tp: 2426.9, pnl: -6.45, openedAt: iso(now() - 42 * 60000), ea: "EA01", magic: 1001, riskToSl: 36.25 },
    { ticket: 5512044, symbol: "XAUUSDc", side: "BUY", volume: 0.1, entry: 2414.8, price: 2411.06, sl: null, tp: 2430, pnl: -58.01, openedAt: iso(now() - 12 * 60000), ea: "manual", magic: 0, riskToSl: null },
  ],
  trades: () => {
    reset();
    return Array.from({ length: 40 }, (_, i) => {
      const side = rnd() > 0.5 ? "BUY" : "SELL"; const entry = 2380 + rnd() * 50; const move = (rnd() - 0.45) * 12;
      const vol = [0.01, 0.02, 0.05][Math.floor(rnd() * 3)]; const gross = +(move * vol * 100).toFixed(2); const comm = -(vol * 7).toFixed(2);
      const ea = ["EA01", "EA02", "EA03"][i % 3]; const t = now() - i * 7 * 3600000;
      return { id: 900000 + i, symbol: "XAUUSDc", side, ea, magic: 1001 + (i % 3), volume: vol, entry: +entry.toFixed(2), exit: +(entry + (side === "BUY" ? move : -move)).toFixed(2), sl: +(entry - 7).toFixed(2), tp: +(entry + 14).toFixed(2), gross, commission: comm, swap: 0, net: +(gross + comm).toFixed(2), openedAt: iso(t - 3600000 * (1 + rnd() * 4)), closedAt: iso(t), r: +(move / 7).toFixed(2), source: i % 4 === 0 ? "import" : "live", exitReason: move > 0 ? "TP" : "SL" };
    });
  },
  events: () => {
    const b = now() - 5 * 60000;
    return [
      { id: "e1", t: iso(b), ea: "EA01", type: "BAR_NEW", status: "info", msg: "New M5 bar detected" },
      { id: "e2", t: iso(b + 120), ea: "EA01", type: "DATA_CHECK", status: "pass", msg: "Market & indicator data ok" },
      { id: "e3", t: iso(b + 260), ea: "EA01", type: "SIGNAL_EVAL", status: "pass", msg: "Pullback to VWAP, direction BUY" },
      { id: "e4", t: iso(b + 300), ea: "EA01", type: "NEWS_FILTER", status: "pass", msg: "No high-impact event within 30m" },
      { id: "e5", t: iso(b + 320), ea: "EA01", type: "SPREAD_FILTER", status: "fail", msg: "Spread 42 pts > max 30 pts" },
      { id: "e6", t: iso(b + 330), ea: "EA01", type: "ENTRY_SKIPPED", status: "skip", msg: "Order intentionally skipped: SPREAD_TOO_WIDE" },
      { id: "e7", t: iso(b + 61000), ea: "EA02", type: "ORDER_SEND", status: "fail", msg: "retcode 10016 TRADE_RETCODE_INVALID_STOPS" },
      { id: "e8", t: iso(b + 90000), ea: "EA03", type: "INDICATOR_ERROR", status: "error", msg: "iATR handle invalid (4806)" },
    ];
  },
  imports: () => [
    { id: "imp-3", file: "ReportHistory-2026-09.csv", at: iso(now() - 86400000 * 2), type: "MT5 Deals", range: "2026-09-01 → 2026-09-30", parsed: 412, accepted: 398, rejected: 4, duplicates: 10, status: "completed" },
    { id: "imp-2", file: "ReportHistory-2026-08.csv", at: iso(now() - 86400000 * 30), type: "MT5 Deals", range: "2026-08-01 → 2026-08-31", parsed: 380, accepted: 380, rejected: 0, duplicates: 0, status: "completed" },
  ],
  research: () => [
    { id: "r1", strategy: "EA01 Trend Pullback", period: "2023-01 → 2026-06", model: "Every tick real", trades: 1240, pf: 1.36, maxDd: 9.4, sharpe: 1.1, oos: true, status: "validated-oos" },
    { id: "r2", strategy: "EA02 Liquidity Sweep", period: "2024-01 → 2026-06", model: "1m OHLC", trades: 410, pf: 1.52, maxDd: 12.1, sharpe: 1.3, oos: false, status: "in-sample only" },
    { id: "r3", strategy: "EA03 Breakout", period: "2025-01 → 2026-06", model: "Every tick", trades: 88, pf: 1.12, maxDd: 7.0, sharpe: 0.4, oos: false, status: "insufficient sample" },
  ],
  market: () => ({ configured: false, events: [] as unknown[] }),
  system: () => ({ api: "simulated", db: "simulated", version: "demo", uptime: "—" }),
};
